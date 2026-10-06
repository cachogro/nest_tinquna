import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';

import { Usuario } from 'src/security/entities/usuario.entity';
import { PromedioMineral } from 'src/cluster/comercio-interno/entities/promedio/promedio-mineral.entity';
import {
  Cliente,
  ModalidadVentaCliente,
} from 'src/cluster/parametricas/entities/cliente.entity';
import { Kardex } from '../entities/kardex.entity';
import { MovimientoKardex } from '../entities/movimiento-kardex.entity';
import { VentaLote } from '../entities/venta-lote.entity';
import { MonedaCaja } from '../entities/periodo-caja.entity';
import {
  CreateVentaLoteDto,
  EstimarVentaLoteDto,
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

/**
 * Cuenta corriente de un cliente comprador, calculada desde su kardex CLIENTE
 * (todo en Bs.). Lo recibido se aplica a sus lotes LIQUIDADOS del más antiguo
 * al más nuevo; un lote sin liquidar no recibe nada.
 */
export interface CuentaClienteVenta {
  idCliente: string;
  modalidadVenta: ModalidadVentaCliente;
  /** Tiene un kardex CLIENTE abierto (sin él no puede recibir anticipos). */
  kardexAbierto: boolean;
  /** Todo lo que entregó el cliente (HABER de su kardex). */
  anticiposBolivianos: number;
  /** Cargos que no son liquidaciones de lote (más el saldo inicial). */
  otrosCargosBolivianos: number;
  /** Suma de las liquidaciones de sus lotes. */
  liquidadoBolivianos: number;
  /** De lo recibido, lo que ya está pagando lotes liquidados. */
  aplicadoBolivianos: number;
  /** Recibido que todavía no tiene un lote liquidado que pagar. */
  anticipoDisponibleBolivianos: number;
  /** anticipos − cargos − liquidado. Positivo = a favor del cliente (se le
   *  deben lotes); negativo = el cliente debe. */
  saldoBolivianos: number;
  lotesAbiertos: number;
  lotesLiquidados: number;
  lotesPagados: number;
  /** Estimado propio de los lotes entregados y aún sin liquidar. */
  estimadoAbiertosBolivianos: number;
  lotesAbiertosSinEstimar: number;
  /** Saldo si los lotes abiertos se liquidaran por lo estimado. */
  saldoProyectadoBolivianos: number;
}

type CuentaCalculada = CuentaClienteVenta & {
  /** Lo que la cuenta del cliente le asigna a cada lote liquidado. */
  asignadoPorVenta: Map<string, number>;
};

/** Línea de la cuenta corriente del cliente (un movimiento de su kardex). */
export interface MovimientoCuentaCliente {
  id: string;
  fecha: string;
  /** ANTICIPO = dinero del cliente; LOTE = liquidación de un lote; CARGO = otro cargo. */
  tipo: 'ANTICIPO' | 'LOTE' | 'CARGO';
  detalle: string;
  lote: string | null;
  comprobante: string | null;
  idRecibo: string | null;
  moneda: MonedaCaja;
  /** Monto original en USD (0 si fue en Bs.). */
  montoUsd: number;
  /** Positivo = a favor del cliente; negativo = cargo. */
  montoBolivianos: number;
  /** Saldo corrido, mismo signo que `CuentaClienteVenta.saldoBolivianos`. */
  saldoBolivianos: number;
}

/** Venta con su seguimiento de cobro y rentabilidad (todo en Bs.). */
export type VentaLoteConResumen = VentaLote &
  TotalesCobroVenta & {
    modalidadVenta: ModalidadVentaCliente;
    /** Parte de `cobradoBolivianos` que viene de la cuenta del cliente
     *  (anticipos sin lote). En COMERCIO_INTERNO es todo lo cobrado. */
    cobradoAnticiposClienteBolivianos: number;
    /** Anticipos del cliente que todavía no pagan ningún lote: es lo que
     *  cubriría este lote al liquidarlo. */
    anticipoDisponibleClienteBolivianos: number;
    /** Monto de venta − cobrado; null mientras no esté LIQUIDADA. Negativo =
     *  los anticipos superaron la liquidación (saldo a favor del cliente). */
    porCobrarBolivianos: number | null;
    /** Monto de venta − efectivo invertido; null mientras no esté LIQUIDADA. */
    utilidadBolivianos: number | null;
    /** LIQUIDADA y lo cobrado cubre el monto de venta. */
    pagada: boolean;
    /** Monto de venta − monto estimado, en la moneda de la venta; null si
     *  falta la liquidación o la estimación. Negativo = el comprador liquidó
     *  menos de lo que estimó la empresa. */
    diferenciaEstimado: number | null;
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
    if (filtro.modalidad) {
      q.andWhere('cliente.modalidadVenta = :modalidad', { modalidad: filtro.modalidad });
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

    const [totales, cuentas] = await Promise.all([
      this.totalesCobro(ventas.map((v) => v.id)),
      this.calcularCuentas(ventas.map((v) => v.idCliente)),
    ]);
    return {
      data: ventas.map((v) =>
        this.conResumen(v, totales.get(v.id), cuentas.get(String(v.idCliente))),
      ),
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
    const [totales, cuentas] = await Promise.all([
      this.totalesCobro([venta.id]),
      this.calcularCuentas([venta.idCliente]),
    ]);
    return this.conResumen(
      venta,
      totales.get(venta.id),
      cuentas.get(String(venta.idCliente)),
    );
  }

  /**
   * Todos los clientes compradores activos con su cuenta corriente, primero
   * comercio interno y luego exportación, por nombre.
   */
  async cuentasClientes(): Promise<Array<CuentaClienteVenta & { cliente: Cliente }>> {
    const clientes = await this.clienteRepository.find({
      where: { activo: true },
      order: { nombre: 'ASC' },
    });
    const cuentas = await this.calcularCuentas(clientes.map((c) => c.id));
    return clientes
      .map((cliente) => ({
        ...this.cuentaPublica(cuentas.get(String(cliente.id))!),
        cliente,
      }))
      .sort((a, b) => a.modalidadVenta.localeCompare(b.modalidadVenta));
  }

  /**
   * Cuenta corriente de un cliente: resumen, sus lotes vigentes (con lo que
   * la cuenta le paga a cada uno) y la línea de tiempo de su kardex con el
   * saldo corrido.
   */
  async cuentaCliente(idCliente: string): Promise<{
    cliente: Cliente;
    cuenta: CuentaClienteVenta;
    ventas: VentaLoteConResumen[];
    movimientos: MovimientoCuentaCliente[];
  }> {
    const cliente = await this.clienteRepository.findOne({
      where: { id: String(idCliente) },
    });
    if (!cliente) {
      throw new NotFoundException(`No existe el cliente ${idCliente}.`);
    }
    const ventas = await this.ventaRepository
      .createQueryBuilder('venta')
      .leftJoinAndSelect('venta.promedioMineral', 'promedio')
      .leftJoinAndSelect('venta.cliente', 'cliente')
      .where('venta.idCliente = :idCliente', { idCliente: cliente.id })
      .andWhere("venta.estado <> 'ANULADA'")
      .andWhere('venta.activo = true')
      .orderBy('venta.fechaVenta', 'ASC')
      .addOrderBy('venta.id', 'ASC')
      .getMany();

    const [totales, cuentas, movimientos] = await Promise.all([
      this.totalesCobro(ventas.map((v) => v.id)),
      this.calcularCuentas([cliente.id]),
      this.movimientosCuenta(cliente.id, ventas),
    ]);
    const cuenta = cuentas.get(String(cliente.id))!;
    return {
      cliente,
      cuenta: this.cuentaPublica(cuenta),
      ventas: ventas.map((v) => this.conResumen(v, totales.get(v.id), cuenta)),
      movimientos,
    };
  }

  private cuentaPublica(cuenta: CuentaCalculada): CuentaClienteVenta {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { asignadoPorVenta, ...publica } = cuenta;
    return publica;
  }

  /**
   * Arma la cuenta corriente de cada cliente desde su kardex CLIENTE:
   * HABER = lo que entregó, DEBE = liquidaciones de lote (más otros cargos).
   *
   *   COMERCIO_INTERNO: todo lo recibido es una sola bolsa que paga los lotes
   *     LIQUIDADOS por orden de liquidación. El recibo puede o no nombrar un
   *     lote: igual entra a la bolsa.
   *   EXPORTACION: el recibo de un lote paga ese lote; solo lo recibido sin
   *     lote forma la bolsa, que cubre los lotes liquidados con saldo.
   *
   * Un lote ABIERTO (sin liquidar) nunca recibe nada de la bolsa.
   */
  private async calcularCuentas(
    idsCliente: Array<string | number>,
  ): Promise<Map<string, CuentaCalculada>> {
    const mapa = new Map<string, CuentaCalculada>();
    const ids = [...new Set(idsCliente.map(String))];
    if (!ids.length) return mapa;

    const [clientes, ventas, movimientos, kardex] = await Promise.all([
      this.clienteRepository.find({ where: { id: In(ids) } }),
      this.ventaRepository
        .createQueryBuilder('venta')
        .where('venta.idCliente IN (:...ids)', { ids })
        .andWhere("venta.estado <> 'ANULADA'")
        .andWhere('venta.activo = true')
        .getMany(),
      this.dataSource.query(
        `SELECT k.id_cliente, m.id, m.debe, m.haber, r.id_venta_lote
           FROM contabilidad.movimiento_kardex m
           JOIN contabilidad.kardex k ON k.id = m.id_kardex
           LEFT JOIN contabilidad.recibo r ON r.id = m.id_recibo
          WHERE k.tipo = 'CLIENTE'
            AND k.activo = true
            AND m.activo = true
            AND k.id_cliente = ANY($1::bigint[])`,
        [ids],
      ) as Promise<
        Array<{
          id_cliente: string;
          id: string;
          debe: string;
          haber: string;
          id_venta_lote: string | null;
        }>
      >,
      // El saldo inicial solo cuenta en el primer kardex: los siguientes lo
      // arrastran del cierre del anterior (sería contarlo dos veces).
      this.dataSource.query(
        `SELECT id_cliente,
                COALESCE(SUM(saldo_inicial) FILTER (WHERE id_kardex_anterior IS NULL), 0) AS saldo_inicial,
                BOOL_OR(estado = 'ABIERTO') AS abierto
           FROM contabilidad.kardex
          WHERE tipo = 'CLIENTE'
            AND activo = true
            AND id_cliente = ANY($1::bigint[])
          GROUP BY id_cliente`,
        [ids],
      ) as Promise<Array<{ id_cliente: string; saldo_inicial: string; abierto: boolean }>>,
    ]);
    const directos = await this.totalesCobro(ventas.map((v) => v.id));

    for (const cliente of clientes) {
      const idCliente = String(cliente.id);
      const esExportacion = cliente.modalidadVenta === 'EXPORTACION';
      const ventasCliente = ventas.filter((v) => String(v.idCliente) === idCliente);
      const idsVenta = new Set(ventasCliente.map((v) => String(v.id)));
      const idsMovLiquidacion = new Set(
        ventasCliente
          .filter((v) => v.idMovimientoKardexLiquidacion)
          .map((v) => String(v.idMovimientoKardexLiquidacion)),
      );
      const kardexCliente = kardex.find((k) => String(k.id_cliente) === idCliente);

      let anticipos = 0;
      // Saldo del kardex = DEBE − HABER: un saldo inicial positivo es deuda del cliente.
      let cargos = Number(kardexCliente?.saldo_inicial ?? 0);
      let conLote = 0;
      for (const mov of movimientos) {
        if (String(mov.id_cliente) !== idCliente) continue;
        if (idsMovLiquidacion.has(String(mov.id))) continue;
        anticipos += Number(mov.haber);
        cargos += Number(mov.debe);
        if (esExportacion && mov.id_venta_lote && idsVenta.has(String(mov.id_venta_lote))) {
          conLote += Number(mov.haber) - Number(mov.debe);
        }
      }

      const liquidadas = ventasCliente
        .filter((v) => v.estado === 'LIQUIDADA' && v.montoVentaBolivianos != null)
        .sort(
          (a, b) =>
            String(a.fechaLiquidacion ?? '').localeCompare(String(b.fechaLiquidacion ?? '')) ||
            Number(a.id) - Number(b.id),
        );
      const abiertas = ventasCliente.filter((v) => v.estado === 'ABIERTA');

      let bolsa = this.r2(anticipos - cargos - conLote);
      let liquidado = 0;
      let aplicado = 0;
      let pagados = 0;
      const asignadoPorVenta = new Map<string, number>();
      for (const venta of liquidadas) {
        const monto = Number(venta.montoVentaBolivianos);
        const directo = esExportacion
          ? (directos.get(venta.id)?.cobradoBolivianos ?? 0)
          : 0;
        const falta = Math.max(this.r2(monto - directo), 0);
        const asignado = this.r2(Math.min(falta, Math.max(bolsa, 0)));
        bolsa = this.r2(bolsa - asignado);
        asignadoPorVenta.set(String(venta.id), asignado);
        liquidado += monto;
        aplicado += Math.min(monto, directo + asignado);
        if (monto - directo - asignado <= 0.005) pagados++;
      }

      const estimadoAbiertos = abiertas.reduce(
        (suma, v) =>
          suma +
          (v.montoEstimado != null
            ? Number(v.montoEstimado) * (v.moneda === 'USD' ? Number(v.tipoCambio ?? 0) : 1)
            : 0),
        0,
      );
      const saldo = this.r2(anticipos - cargos - liquidado);

      mapa.set(idCliente, {
        idCliente,
        modalidadVenta: cliente.modalidadVenta,
        kardexAbierto: kardexCliente?.abierto === true,
        anticiposBolivianos: this.r2(anticipos),
        otrosCargosBolivianos: this.r2(cargos),
        liquidadoBolivianos: this.r2(liquidado),
        aplicadoBolivianos: this.r2(aplicado),
        anticipoDisponibleBolivianos: Math.max(bolsa, 0),
        saldoBolivianos: saldo,
        lotesAbiertos: abiertas.length,
        lotesLiquidados: liquidadas.length,
        lotesPagados: pagados,
        estimadoAbiertosBolivianos: this.r2(estimadoAbiertos),
        lotesAbiertosSinEstimar: abiertas.filter((v) => v.montoEstimado == null).length,
        saldoProyectadoBolivianos: this.r2(saldo - estimadoAbiertos),
        asignadoPorVenta,
      });
    }
    return mapa;
  }

  /** Kardex del cliente como línea de tiempo, con saldo corrido a su favor. */
  private async movimientosCuenta(
    idCliente: string,
    ventas: VentaLote[],
  ): Promise<MovimientoCuentaCliente[]> {
    const idsMovLiquidacion = new Set(
      ventas
        .filter((v) => v.idMovimientoKardexLiquidacion)
        .map((v) => String(v.idMovimientoKardexLiquidacion)),
    );
    const filas: Array<{
      id: string;
      fecha: string;
      detalle: string;
      lote: string | null;
      nro_comprobante: string | null;
      moneda: MonedaCaja;
      debe: string;
      haber: string;
      debe_usd: string;
      haber_usd: string;
      id_recibo: string | null;
      serie: string | null;
      numero: number | null;
      saldo_inicial: string;
      primero: boolean;
    }> = await this.dataSource.query(
      `SELECT m.id, to_char(m.fecha, 'YYYY-MM-DD') AS fecha, m.detalle, m.lote,
              m.nro_comprobante, m.moneda, m.debe, m.haber, m.debe_usd, m.haber_usd,
              m.id_recibo, r.serie, r.numero,
              k.saldo_inicial, (k.id_kardex_anterior IS NULL) AS primero
         FROM contabilidad.movimiento_kardex m
         JOIN contabilidad.kardex k ON k.id = m.id_kardex
         LEFT JOIN contabilidad.recibo r ON r.id = m.id_recibo
        WHERE k.tipo = 'CLIENTE'
          AND k.activo = true
          AND m.activo = true
          AND k.id_cliente = $1
        ORDER BY k.numero ASC, m.numero_linea ASC, m.id ASC`,
      [idCliente],
    );

    const primero = filas.find((f) => f.primero);
    let saldo = primero ? -Number(primero.saldo_inicial) : 0;
    return filas.map((f) => {
      const debe = Number(f.debe);
      const haber = Number(f.haber);
      const monto = this.r2(haber - debe);
      saldo = this.r2(saldo + monto);
      return {
        id: String(f.id),
        fecha: f.fecha,
        tipo: idsMovLiquidacion.has(String(f.id))
          ? 'LOTE'
          : haber > 0
            ? 'ANTICIPO'
            : 'CARGO',
        detalle: f.detalle,
        lote: f.lote,
        comprobante:
          f.serie && f.numero != null
            ? `${f.serie}-${String(f.numero).padStart(4, '0')}`
            : f.nro_comprobante,
        idRecibo: f.id_recibo ? String(f.id_recibo) : null,
        moneda: f.moneda,
        montoUsd: this.r2(Number(f.haber_usd) - Number(f.debe_usd)),
        montoBolivianos: monto,
        saldoBolivianos: saldo,
      };
    });
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

  /**
   * `cuenta` es la cuenta corriente del cliente de la venta. En comercio
   * interno lo cobrado del lote es solo lo que esa cuenta le asigna (los
   * recibos no pertenecen a un lote); en exportación, sus recibos propios más
   * lo que le toque de los anticipos sin lote.
   */
  private conResumen(
    venta: VentaLote,
    totales: TotalesCobroVenta = TOTALES_VACIOS,
    cuenta?: CuentaCalculada,
  ): VentaLoteConResumen {
    const modalidadVenta = cuenta?.modalidadVenta ?? 'EXPORTACION';
    const esInterno = modalidadVenta === 'COMERCIO_INTERNO';
    const asignado = cuenta?.asignadoPorVenta.get(String(venta.id)) ?? 0;
    const cobrado = this.r2((esInterno ? 0 : totales.cobradoBolivianos) + asignado);

    const liquidada = venta.estado === 'LIQUIDADA' && venta.montoVentaBolivianos != null;
    const montoBs = Number(venta.montoVentaBolivianos ?? 0);
    const porCobrar = liquidada ? this.r2(montoBs - cobrado) : null;
    return Object.assign(venta, totales, {
      modalidadVenta,
      cobradoBolivianos: cobrado,
      cobradoUsd: esInterno ? 0 : totales.cobradoUsd,
      cobradoAnticiposClienteBolivianos: asignado,
      anticipoDisponibleClienteBolivianos: cuenta?.anticipoDisponibleBolivianos ?? 0,
      porCobrarBolivianos: porCobrar,
      utilidadBolivianos: liquidada
        ? this.r2(montoBs - Number(venta.totalEfectivoInvertido))
        : null,
      pagada: liquidada && (porCobrar ?? 0) <= 0.005,
      diferenciaEstimado:
        liquidada && venta.montoVenta != null && venta.montoEstimado != null
          ? this.r2(Number(venta.montoVenta) - Number(venta.montoEstimado))
          : null,
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
   * Guarda (o quita, con null) lo que la empresa estima que vale el lote.
   * Es solo una referencia para comparar con la liquidación del comprador:
   * no toca kardex, caja ni banco, así que se puede corregir en cualquier
   * estado vigente.
   */
  async estimar(
    id: string,
    dto: EstimarVentaLoteDto,
    user: Usuario,
  ): Promise<VentaLoteConResumen> {
    const venta = await this.obtenerVigente(id);
    await this.ventaRepository.update(venta.id, {
      montoEstimado: dto.montoEstimado == null ? null : this.r2(dto.montoEstimado),
      usuarioUltimaModificacion: user.usuario,
    } as any);
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
