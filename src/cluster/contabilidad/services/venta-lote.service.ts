import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';

import { Usuario } from 'src/security/entities/usuario.entity';
import { PromedioMineral } from 'src/cluster/comercio-interno/entities/promedio/promedio-mineral.entity';
import { Cliente } from 'src/cluster/parametricas/entities/cliente.entity';
import { Kardex } from '../entities/kardex.entity';
import { MovimientoKardex } from '../entities/movimiento-kardex.entity';
import { VentaLote } from '../entities/venta-lote.entity';
import { MonedaCaja } from '../entities/periodo-caja.entity';
import {
  CreateVentaLoteDto,
  FiltroPromediosDisponiblesVentaDto,
  FiltroVentaLoteDto,
  LiquidarVentaLoteDto,
  UpdateVentaLoteDto,
} from '../dto/venta-lote/venta-lote.dto';
import { aBolivianos, resolverTipoCambio } from '../moneda.util';
import { KardexActividadService } from './kardex-actividad.service';
import { MovimientoKardexService } from './movimiento-kardex.service';

/** Cuánto se cobró de una venta (recibos de INGRESO vinculados), en Bs. */
export interface TotalesCobroVenta {
  /** Recibos PROCESADOS (ya movieron kardex y caja/banco), en Bs. */
  cobradoBolivianos: number;
  /** Parte de lo cobrado que entró en USD (monto original). */
  cobradoUsd: number;
  /** Recibos en BORRADOR (todavía no movieron plata), en Bs. */
  pendienteBolivianos: number;
  cantidadCobros: number;
}

/** Venta con su seguimiento de cobro y rentabilidad (todo en Bs.). */
export type VentaLoteConResumen = VentaLote &
  TotalesCobroVenta & {
    /** Monto de venta − cobrado; null mientras no esté LIQUIDADA. Negativo =
     *  los anticipos superaron la liquidación (saldo a favor del cliente). */
    porCobrarBolivianos: number | null;
    /** Monto de venta − efectivo invertido; null mientras no esté LIQUIDADA. */
    utilidadBolivianos: number | null;
    /** LIQUIDADA y lo cobrado cubre el monto de venta. */
    pagada: boolean;
  };

const TOTALES_VACIOS: TotalesCobroVenta = {
  cobradoBolivianos: 0,
  cobradoUsd: 0,
  pendienteBolivianos: 0,
  cantidadCobros: 0,
};

@Injectable()
export class VentaLoteService {
  constructor(
    @InjectRepository(VentaLote, 'ci')
    private readonly ventaRepository: Repository<VentaLote>,

    @InjectRepository(PromedioMineral, 'ci')
    private readonly promedioRepository: Repository<PromedioMineral>,

    @InjectRepository(Cliente, 'ci')
    private readonly clienteRepository: Repository<Cliente>,

    @InjectRepository(Kardex, 'ci')
    private readonly kardexRepository: Repository<Kardex>,

    @InjectDataSource('ci')
    private readonly dataSource: DataSource,

    private readonly movimientoKardexService: MovimientoKardexService,
    private readonly kardexActividadService: KardexActividadService,
  ) {}

  private r2(n: number): number {
    return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  }

  // ------------------------------------------------------------ Consultas

  /** Promedios activos que todavía no tienen una venta vigente. */
  async promediosDisponibles(
    filtro: FiltroPromediosDisponiblesVentaDto,
  ): Promise<PromedioMineral[]> {
    const q = this.promedioRepository
      .createQueryBuilder('promedio')
      .leftJoinAndSelect('promedio.codificacionLote', 'codificacionLote')
      .leftJoin(
        VentaLote,
        'venta',
        "venta.idPromedioMineral = promedio.id AND venta.estado <> 'ANULADA'",
      )
      .where('promedio.activo = true')
      .andWhere('venta.id IS NULL');
    if (filtro.busqueda?.trim()) {
      q.andWhere(
        '(promedio.codigoLote ILIKE :b OR promedio.codigo ILIKE :b OR promedio.descripcion ILIKE :b)',
        { b: `%${filtro.busqueda.trim()}%` },
      );
    }
    return q.orderBy('promedio.id', 'DESC').take(100).getMany();
  }

  async listar(filtro: FiltroVentaLoteDto) {
    const page = Number(filtro.page) || 1;
    const limit = Number(filtro.limit) || 10;
    const q = this.ventaRepository
      .createQueryBuilder('venta')
      .leftJoinAndSelect('venta.promedioMineral', 'promedio')
      .leftJoinAndSelect('venta.cliente', 'cliente')
      .where('venta.activo = true');
    if (filtro.estado) {
      q.andWhere('venta.estado = :estado', { estado: filtro.estado });
    }
    if (filtro.idCliente) {
      q.andWhere('venta.idCliente = :idCliente', { idCliente: filtro.idCliente });
    }
    if (filtro.busqueda?.trim()) {
      q.andWhere(
        '(venta.codigoLote ILIKE :b OR promedio.codigo ILIKE :b OR cliente.nombre ILIKE :b)',
        { b: `%${filtro.busqueda.trim()}%` },
      );
    }
    const [ventas, total] = await q
      .orderBy('venta.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const totales = await this.totalesCobro(ventas.map((v) => v.id));
    return {
      data: ventas.map((v) => this.conResumen(v, totales.get(v.id))),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async buscarPorId(id: string): Promise<VentaLoteConResumen> {
    const venta = await this.ventaRepository
      .createQueryBuilder('venta')
      .leftJoinAndSelect('venta.promedioMineral', 'promedio')
      .leftJoinAndSelect('promedio.codificacionLote', 'codificacionLote')
      .leftJoinAndSelect('venta.cliente', 'cliente')
      .leftJoinAndSelect('venta.recibos', 'recibo')
      .leftJoinAndSelect('recibo.formaPago', 'formaPago')
      .leftJoinAndSelect('recibo.cuentaBancaria', 'cuentaBancaria')
      .leftJoinAndSelect('cuentaBancaria.entidadFinanciera', 'entidadFinanciera')
      .where('venta.id = :id', { id })
      .orderBy('recibo.fecha', 'ASC')
      .addOrderBy('recibo.id', 'ASC')
      .getOne();
    if (!venta) {
      throw new NotFoundException(`No existe la venta de lote ${id}.`);
    }
    const totales = await this.totalesCobro([venta.id]);
    return this.conResumen(venta, totales.get(venta.id));
  }

  /**
   * Suma de los recibos vigentes de cada venta, en Bs. (los de USD con su
   * propio tipo de cambio). PROCESADO = cobrado; BORRADOR = pendiente.
   */
  async totalesCobro(
    idsVenta: string[],
    manager: EntityManager = this.dataSource.manager,
  ): Promise<Map<string, TotalesCobroVenta>> {
    const mapa = new Map<string, TotalesCobroVenta>();
    if (!idsVenta.length) return mapa;
    const filas: Array<{
      id: string;
      cobrado: string;
      cobrado_usd: string;
      pendiente: string;
      cantidad: string;
    }> = await manager.query(
      `SELECT r.id_venta_lote AS id,
              COALESCE(SUM(CASE WHEN r.estado = 'PROCESADO' THEN ${this.sqlBs('r')} END), 0) AS cobrado,
              COALESCE(SUM(CASE WHEN r.estado = 'PROCESADO' AND r.moneda = 'USD' THEN r.monto_total END), 0) AS cobrado_usd,
              COALESCE(SUM(CASE WHEN r.estado = 'BORRADOR' THEN ${this.sqlBs('r')} END), 0) AS pendiente,
              COUNT(*) FILTER (WHERE r.estado = 'PROCESADO') AS cantidad
         FROM contabilidad.recibo r
        WHERE r.id_venta_lote = ANY($1::bigint[])
          AND r.estado <> 'ANULADO'
          AND r.activo = true
        GROUP BY r.id_venta_lote`,
      [idsVenta],
    );
    for (const f of filas) {
      mapa.set(String(f.id), {
        cobradoBolivianos: this.r2(Number(f.cobrado)),
        cobradoUsd: this.r2(Number(f.cobrado_usd)),
        pendienteBolivianos: this.r2(Number(f.pendiente)),
        cantidadCobros: Number(f.cantidad),
      });
    }
    return mapa;
  }

  /** Monto del recibo en Bs. (mismo redondeo que aBolivianos). */
  private sqlBs(alias: string): string {
    return `ROUND(CASE WHEN ${alias}.moneda = 'USD' THEN ${alias}.monto_total * ${alias}.tipo_cambio ELSE ${alias}.monto_total END, 2)`;
  }

  private conResumen(
    venta: VentaLote,
    totales: TotalesCobroVenta = TOTALES_VACIOS,
  ): VentaLoteConResumen {
    const liquidada = venta.estado === 'LIQUIDADA' && venta.montoVentaBolivianos != null;
    const montoBs = Number(venta.montoVentaBolivianos ?? 0);
    const porCobrar = liquidada ? this.r2(montoBs - totales.cobradoBolivianos) : null;
    return Object.assign(venta, totales, {
      porCobrarBolivianos: porCobrar,
      utilidadBolivianos: liquidada
        ? this.r2(montoBs - Number(venta.totalEfectivoInvertido))
        : null,
      pagada: liquidada && (porCobrar ?? 0) <= 0.005,
    });
  }

  // ------------------------------------------------------------ Escritura

  async crear(dto: CreateVentaLoteDto, user: Usuario): Promise<VentaLoteConResumen> {
    const promedio = await this.promedioRepository.findOne({
      where: { id: String(dto.idPromedioMineral) },
    });
    if (!promedio || !promedio.activo) {
      throw new NotFoundException('No se encontró el promedio (lote) o está anulado.');
    }
    const vigente = await this.ventaVigenteDePromedio(promedio.id);
    if (vigente) {
      throw new ConflictException(
        `El lote ${promedio.codigoLote ?? promedio.codigo} ya está vendido (venta #${vigente.id}, ${vigente.estado}).`,
      );
    }

    const cliente = await this.clienteRepository.findOne({
      where: { id: String(dto.idCliente) },
    });
    if (!cliente || cliente.activo === false) {
      throw new NotFoundException('No se encontró el cliente o está inactivo.');
    }
    // Los anticipos del comprador van a su kardex: tiene que existir antes.
    await this.obtenerKardexAbiertoCliente(cliente.id);

    const moneda: MonedaCaja = dto.moneda ?? 'BS';
    const tipoCambio = resolverTipoCambio(moneda, dto.tipoCambio);

    const venta = await this.ventaRepository.save(
      this.ventaRepository.create({
        idPromedioMineral: promedio.id,
        codigoLote: promedio.codigoLote ?? promedio.codigo,
        idCliente: cliente.id,
        fechaVenta: dto.fechaVenta,
        moneda,
        tipoCambio,
        totalEfectivoInvertido: this.r2(Number(promedio.totalEfectivoInvertido ?? 0)),
        estado: 'ABIERTA',
        observaciones: dto.observaciones?.trim() || null,
        usuarioRegistro: user.usuario,
      }),
    );
    return this.buscarPorId(venta.id);
  }

  async actualizar(
    id: string,
    dto: UpdateVentaLoteDto,
    user: Usuario,
  ): Promise<VentaLoteConResumen> {
    const venta = await this.obtenerVigente(id);
    const cambios: Partial<VentaLote> = { usuarioUltimaModificacion: user.usuario };
    if (dto.fechaVenta !== undefined) cambios.fechaVenta = dto.fechaVenta;
    if (dto.observaciones !== undefined) {
      cambios.observaciones = dto.observaciones?.trim() || null;
    }
    if (dto.tipoCambio !== undefined && venta.moneda === 'USD' && venta.estado === 'ABIERTA') {
      cambios.tipoCambio = dto.tipoCambio;
    }
    await this.ventaRepository.update(venta.id, cambios as any);
    return this.buscarPorId(venta.id);
  }

  /**
   * Registra la liquidación final (neta) del comprador y la carga como DEBE
   * en su kardex: los anticipos (HABER) la van cancelando, así el kardex
   * queda en 0 cuando se terminó de cobrar.
   */
  async liquidar(
    id: string,
    dto: LiquidarVentaLoteDto,
    user: Usuario,
  ): Promise<VentaLoteConResumen> {
    const venta = await this.obtenerVigente(id);
    if (venta.estado !== 'ABIERTA') {
      throw new BadRequestException(
        'La venta ya está liquidada. Para corregir el monto, primero reabrila.',
      );
    }
    const tipoCambio = resolverTipoCambio(venta.moneda, dto.tipoCambio ?? venta.tipoCambio);
    const monto = this.r2(dto.montoVenta);
    const montoBs = aBolivianos(monto, venta.moneda, tipoCambio);
    const kardex = await this.obtenerKardexAbiertoCliente(venta.idCliente);

    await this.dataSource.transaction(async (manager) => {
      const mov = await this.movimientoKardexService.crearLineaSinMovimientoDineroEnTransaccion(
        manager,
        kardex,
        {
          fecha: dto.fechaLiquidacion,
          detalle: `LIQUIDACIÓN VENTA LOTE ${venta.codigoLote ?? ''}`.trim(),
          lote: venta.codigoLote ?? null,
          moneda: venta.moneda,
          tipoCambio,
          debe: montoBs,
          haber: 0,
          debeUsd: venta.moneda === 'USD' ? monto : 0,
          usuarioRegistro: user.usuario,
        },
      );
      await manager.update(VentaLote, venta.id, {
        montoVenta: monto,
        montoVentaBolivianos: montoBs,
        tipoCambio,
        fechaLiquidacion: dto.fechaLiquidacion,
        idMovimientoKardexLiquidacion: mov.id,
        estado: 'LIQUIDADA',
        usuarioUltimaModificacion: user.usuario,
      } as any);
    });
    return this.buscarPorId(venta.id);
  }

  /** Deshace la liquidación (baja la línea DEBE del kardex) para corregirla. */
  async reabrir(id: string, user: Usuario): Promise<VentaLoteConResumen> {
    const venta = await this.obtenerVigente(id);
    if (venta.estado !== 'LIQUIDADA') {
      throw new BadRequestException('Solo se puede reabrir una venta LIQUIDADA.');
    }
    await this.dataSource.transaction(async (manager) => {
      if (venta.idMovimientoKardexLiquidacion) {
        const mov = await manager.findOne(MovimientoKardex, {
          where: { id: venta.idMovimientoKardexLiquidacion },
          relations: { kardex: true },
        });
        if (mov?.kardex && mov.kardex.estado !== 'ABIERTO') {
          throw new BadRequestException(
            'El kardex donde se registró la liquidación ya está cerrado; no se puede reabrir la venta.',
          );
        }
        await this.movimientoKardexService.desactivarLineaSinMovimientoDineroEnTransaccion(
          manager,
          venta.idMovimientoKardexLiquidacion,
          user.usuario,
        );
      }
      await manager.update(VentaLote, venta.id, {
        montoVenta: null,
        montoVentaBolivianos: null,
        fechaLiquidacion: null,
        idMovimientoKardexLiquidacion: null,
        estado: 'ABIERTA',
        usuarioUltimaModificacion: user.usuario,
      } as any);
    });
    return this.buscarPorId(venta.id);
  }

  /** Solo ABIERTA y sin cobros vigentes; libera el promedio. */
  async anular(id: string, user: Usuario): Promise<VentaLoteConResumen> {
    const venta = await this.obtenerVigente(id);
    if (venta.estado !== 'ABIERTA') {
      throw new BadRequestException('Primero reabrí la venta (deshacer la liquidación).');
    }
    const totales = (await this.totalesCobro([venta.id])).get(venta.id);
    if (totales && (totales.cantidadCobros > 0 || totales.pendienteBolivianos > 0)) {
      throw new BadRequestException(
        'La venta tiene cobros vigentes. Anulá esos recibos antes de anular la venta.',
      );
    }
    await this.ventaRepository.update(venta.id, {
      estado: 'ANULADA',
      usuarioUltimaModificacion: user.usuario,
    } as any);
    return this.buscarPorId(venta.id);
  }

  // ------------------------------------------------------------ Apoyo

  /** Venta no ANULADA de un promedio (un lote se vende una sola vez). */
  async ventaVigenteDePromedio(idPromedio: string): Promise<VentaLote | null> {
    return this.ventaRepository
      .createQueryBuilder('venta')
      .where('venta.idPromedioMineral = :idPromedio', { idPromedio })
      .andWhere("venta.estado <> 'ANULADA'")
      .andWhere('venta.activo = true')
      .getOne();
  }

  private async obtenerVigente(id: string): Promise<VentaLote> {
    const venta = await this.ventaRepository.findOne({ where: { id } });
    if (!venta || !venta.activo) {
      throw new NotFoundException(`No existe la venta de lote ${id}.`);
    }
    if (venta.estado === 'ANULADA') {
      throw new BadRequestException('La venta está anulada.');
    }
    return venta;
  }

  private async obtenerKardexAbiertoCliente(idCliente: string): Promise<Kardex> {
    const kardex = await this.kardexRepository.findOne({
      where: { tipo: 'CLIENTE', idCliente, estado: 'ABIERTO' },
    });
    if (!kardex) {
      throw new BadRequestException(
        'El cliente no tiene un kardex abierto. Abrilo primero (Actores y Clientes › Ventas).',
      );
    }
    await this.kardexActividadService.validarActivo(kardex);
    return kardex;
  }
}
