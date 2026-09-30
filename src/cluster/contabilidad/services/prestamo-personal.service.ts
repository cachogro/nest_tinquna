import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';

import { Usuario } from 'src/security/entities/usuario.entity';
import { PersonaCi } from 'src/cluster/comercio-interno/entities/persona-ci.entity';
import { Kardex } from '../entities/kardex.entity';
import { Recibo } from '../entities/recibo.entity';
import { PrestamoPersonal } from '../entities/prestamo-personal.entity';
import {
  MovimientoPrestamo,
  TipoMovimientoPrestamo,
} from '../entities/movimiento-prestamo.entity';
import { CreatePrestamoPersonalDto } from '../dto/prestamo-personal/create-prestamo-personal.dto';
import { AbonarPrestamoDto } from '../dto/prestamo-personal/abonar-prestamo.dto';
import { ActualizarCuotaPrestamoDto } from '../dto/prestamo-personal/actualizar-cuota-prestamo.dto';
import { FiltroPrestamoPersonalDto } from '../dto/prestamo-personal/filtro-prestamo-personal.dto';
import { resolverPersonaAutorizo } from '../persona-autorizo.util';
import { ReciboService } from './recibo.service';
import { MovimientoKardexService } from './movimiento-kardex.service';
import { KardexActividadService } from './kardex-actividad.service';

// Actor productivo minero que representa a la propia empresa: sus personas
// son el personal interno (mismo criterio que PersonaCiService).
const ID_ACTOR_EMPRESA = '1';

const RELACIONES = {
  persona: true,
  recibo: true,
  movimientos: { recibo: true, boletaPago: true },
} as const;

/**
 * Préstamos al personal (ver `PrestamoPersonal`). Toda operación que mueve
 * plata (otorgar, abonar) pasa por un recibo real, dentro de la misma
 * transacción que el sub-libro del préstamo. Los descuentos de sueldo los
 * registra `BoletaPagoService` con `registrarDescuentoSueldoEnTransaccion`
 * (kardex HABER sin movimiento de caja/banco).
 */
@Injectable()
export class PrestamoPersonalService {
  constructor(
    @InjectRepository(PrestamoPersonal, 'ci')
    private readonly prestamoRepository: Repository<PrestamoPersonal>,

    @InjectRepository(PersonaCi, 'ci')
    private readonly personaRepository: Repository<PersonaCi>,

    @InjectRepository(Kardex, 'ci')
    private readonly kardexRepository: Repository<Kardex>,

    private readonly reciboService: ReciboService,
    private readonly movimientoKardexService: MovimientoKardexService,
    private readonly kardexActividadService: KardexActividadService,

    @InjectDataSource('ci')
    private readonly dataSource: DataSource,
  ) {}

  // ------------------------------------------------------------------ helpers
  private r2(n: number | string): number {
    return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  }

  /** Persona activa que es personal interno de la empresa. */
  async obtenerPersonal(idPersona: string): Promise<PersonaCi> {
    const persona = await this.personaRepository.findOne({
      where: { id: String(idPersona) },
    });
    if (!persona) {
      throw new NotFoundException('No se encontró la persona.');
    }
    if (!persona.activo) {
      throw new BadRequestException('La persona está inactiva.');
    }
    if (String(persona.idActorProductivoMinero) !== ID_ACTOR_EMPRESA) {
      throw new BadRequestException(
        'La persona no es personal de la empresa: los préstamos y boletas de pago son solo para el personal interno.',
      );
    }
    return persona;
  }

  /** Kardex PERSONAL abierto y activo (no INACTIVO por días) de la persona. */
  async obtenerKardexPersonal(idPersona: string): Promise<Kardex> {
    const kardex = await this.kardexRepository.findOne({
      where: { tipo: 'PERSONAL', idPersona: String(idPersona), estado: 'ABIERTO' },
      relations: { persona: true },
    });
    if (!kardex) {
      throw new BadRequestException(
        'La persona no tiene un kardex PERSONAL abierto. Abrí uno (POST /contabilidad/kardex) primero.',
      );
    }
    await this.kardexActividadService.validarActivo(kardex);
    return kardex;
  }

  /** Préstamos VIGENTES de una persona, del más antiguo al más nuevo. */
  async listarVigentesDePersona(idPersona: string): Promise<PrestamoPersonal[]> {
    return this.prestamoRepository.find({
      where: { idPersona: String(idPersona), estado: 'VIGENTE', activo: true },
      order: { fecha: 'ASC', id: 'ASC' },
    });
  }

  private async siguienteNumero(manager: EntityManager): Promise<number> {
    const row = await manager
      .createQueryBuilder(PrestamoPersonal, 'p')
      .select('COALESCE(MAX(p.numero), 0)', 'max')
      .getRawOne<{ max: string }>();
    return Number(row?.max ?? 0) + 1;
  }

  /** Línea de kardex que generó el (único) detalle de un recibo. */
  private idMovimientoKardexDeRecibo(recibo: Recibo): string {
    const idMov = recibo.detalles?.[0]?.idMovimientoKardex;
    if (!idMov) {
      // No debería pasar: el detalle se armó con idPersona de un kardex abierto.
      throw new BadRequestException(
        'El recibo no generó la línea de kardex esperada.',
      );
    }
    return idMov;
  }

  /** Agrega una línea al sub-libro y recalcula saldo y estado del préstamo. */
  private async agregarLinea(
    manager: EntityManager,
    idPrestamo: string,
    datos: {
      fecha: string;
      tipo: TipoMovimientoPrestamo;
      detalle: string;
      debe: number;
      haber: number;
      idMovimientoKardex: string;
      idRecibo?: string | null;
      idBoletaPago?: string | null;
      usuarioRegistro: string;
    },
  ): Promise<MovimientoPrestamo> {
    const row = await manager
      .createQueryBuilder(MovimientoPrestamo, 'm')
      .select('COALESCE(MAX(m.numeroLinea), 0)', 'max')
      .where('m.idPrestamo = :id', { id: idPrestamo })
      .getRawOne<{ max: string }>();

    const mov = await manager.save(
      manager.create(MovimientoPrestamo, {
        idPrestamo,
        numeroLinea: Number(row?.max ?? 0) + 1,
        fecha: datos.fecha,
        tipo: datos.tipo,
        detalle: datos.detalle.slice(0, 255),
        debe: this.r2(datos.debe),
        haber: this.r2(datos.haber),
        saldo: 0,
        idMovimientoKardex: datos.idMovimientoKardex,
        idRecibo: datos.idRecibo ?? null,
        idBoletaPago: datos.idBoletaPago ?? null,
        usuarioRegistro: datos.usuarioRegistro,
      }),
    );
    await this.recalcularPrestamo(manager, idPrestamo);
    return mov;
  }

  /** saldo = debe - haber acumulado; CANCELADO cuando llega a 0. */
  private async recalcularPrestamo(
    manager: EntityManager,
    idPrestamo: string,
  ): Promise<void> {
    const movs = await manager.find(MovimientoPrestamo, {
      where: { idPrestamo, activo: true },
      order: { numeroLinea: 'ASC', id: 'ASC' },
    });

    let running = 0;
    for (const mov of movs) {
      running = this.r2(running + Number(mov.debe) - Number(mov.haber));
      if (this.r2(mov.saldo) !== running) {
        await manager.update(MovimientoPrestamo, mov.id, { saldo: running });
      }
    }

    await manager.update(PrestamoPersonal, idPrestamo, {
      saldo: running,
      estado: running > 0 ? 'VIGENTE' : 'CANCELADO',
    });
  }

  /**
   * Descuento de sueldo (lo llama BoletaPagoService dentro de su
   * transacción): HABER en el kardex PERSONAL SIN movimiento de caja/banco
   * (esa plata nunca sale) y línea DESCUENTO_SUELDO en el sub-libro. El
   * kardex no guarda referencia a la boleta; el vínculo queda acá.
   */
  async registrarDescuentoSueldoEnTransaccion(
    manager: EntityManager,
    datos: {
      prestamo: PrestamoPersonal;
      kardex: Kardex;
      fecha: string;
      detalle: string;
      monto: number;
      idBoletaPago: string;
      usuarioRegistro: string;
    },
  ): Promise<MovimientoPrestamo> {
    const movKardex =
      await this.movimientoKardexService.crearLineaSinMovimientoDineroEnTransaccion(
        manager,
        datos.kardex,
        {
          fecha: datos.fecha,
          detalle: datos.detalle.slice(0, 255),
          debe: 0,
          haber: datos.monto,
          usuarioRegistro: datos.usuarioRegistro,
        },
      );

    return this.agregarLinea(manager, datos.prestamo.id, {
      fecha: datos.fecha,
      tipo: 'DESCUENTO_SUELDO',
      detalle: datos.detalle,
      debe: 0,
      haber: datos.monto,
      idMovimientoKardex: movKardex.id,
      idBoletaPago: datos.idBoletaPago,
      usuarioRegistro: datos.usuarioRegistro,
    });
  }

  // ------------------------------------------------------------------ CRUD
  /**
   * Otorga el préstamo: recibo de EGRESO con una línea EFECTIVO + idPersona
   * (sale de caja/banco y registra el DEBE en su kardex PERSONAL, como un
   * anticipo más), la cabecera del préstamo y su línea OTORGAMIENTO. Todo en
   * una sola transacción.
   */
  async otorgar(
    dto: CreatePrestamoPersonalDto,
    user: Usuario,
  ): Promise<PrestamoPersonal> {
    const persona = await this.obtenerPersonal(dto.idPersona);
    await this.obtenerKardexPersonal(persona.id);

    const monto = this.r2(dto.monto);
    const cuotaMensual = this.r2(dto.cuotaMensual);
    if (cuotaMensual > monto) {
      throw new BadRequestException(
        `La cuota mensual (${cuotaMensual}) no puede superar el monto del préstamo (${monto}).`,
      );
    }
    const personaAutorizo = await resolverPersonaAutorizo(
      this.personaRepository,
      dto.idPersonaAutorizo,
      'el préstamo',
    );
    const descripcion = dto.descripcion.trim();

    const id = await this.dataSource.transaction(async (manager) => {
      const numero = await this.siguienteNumero(manager);
      const concepto = `PRÉSTAMO N° ${numero}: ${descripcion}`;

      const recibo = await this.reciboService.generarEnTransaccion(
        manager,
        {
          tipo: 'EGRESO',
          fecha: dto.fecha,
          montoTotal: monto,
          concepto,
          idFormaPago: dto.idFormaPago,
          idCuentaBancaria: dto.idCuentaBancaria,
          nroComprobante: dto.nroComprobante,
          idPersona: persona.id,
          idPersonaAutorizo: dto.idPersonaAutorizo,
          detalles: [
            {
              destino: 'EFECTIVO',
              idPersona: persona.id,
              monto,
              idDestinoGasto: dto.idDestinoGasto,
            },
          ],
        },
        user,
      );
      const idMovimientoKardex = this.idMovimientoKardexDeRecibo(recibo);

      const prestamo = await manager.save(
        manager.create(PrestamoPersonal, {
          numero,
          idPersona: persona.id,
          fecha: dto.fecha,
          descripcion,
          monto,
          cuotaMensual,
          saldo: monto,
          estado: 'VIGENTE',
          idRecibo: recibo.id,
          idMovimientoKardex,
          personaAutorizo,
          observaciones: dto.observaciones?.trim() || null,
          usuarioRegistro: user.usuario,
        }),
      );

      await this.agregarLinea(manager, prestamo.id, {
        fecha: dto.fecha,
        tipo: 'OTORGAMIENTO',
        detalle: concepto,
        debe: monto,
        haber: 0,
        idMovimientoKardex,
        idRecibo: recibo.id,
        usuarioRegistro: user.usuario,
      });

      return prestamo.id;
    });

    return this.buscarPorId(id);
  }

  /**
   * Abono con dinero propio (fuera del sueldo): recibo de INGRESO con una
   * línea PERSONAL (entra a caja/banco y registra el HABER en su kardex) y la
   * línea ABONO del sub-libro.
   */
  async abonar(
    id: string,
    dto: AbonarPrestamoDto,
    user: Usuario,
  ): Promise<PrestamoPersonal> {
    const prestamo = await this.prestamoRepository.findOne({ where: { id } });
    if (!prestamo) {
      throw new NotFoundException('No se encontró el préstamo.');
    }
    if (prestamo.estado !== 'VIGENTE') {
      throw new BadRequestException('El préstamo ya está CANCELADO.');
    }
    const monto = this.r2(dto.monto);
    if (monto > this.r2(prestamo.saldo)) {
      throw new BadRequestException(
        `El abono (${monto}) supera el saldo del préstamo N° ${prestamo.numero} (${this.r2(prestamo.saldo)}).`,
      );
    }
    await this.obtenerKardexPersonal(prestamo.idPersona);
    const concepto = `ABONO A PRÉSTAMO N° ${prestamo.numero}: ${prestamo.descripcion}`;

    await this.dataSource.transaction(async (manager) => {
      const recibo = await this.reciboService.generarEnTransaccion(
        manager,
        {
          tipo: 'INGRESO',
          fecha: dto.fecha,
          montoTotal: monto,
          concepto: concepto.slice(0, 255),
          idFormaPago: dto.idFormaPago,
          idCuentaBancaria: dto.idCuentaBancaria,
          nroComprobante: dto.nroComprobante,
          idPersona: prestamo.idPersona,
          idPersonaAutorizo: dto.idPersonaAutorizo,
          detalles: [
            {
              destino: 'PERSONAL',
              idPersona: prestamo.idPersona,
              monto,
              idDestinoGasto: dto.idDestinoGasto,
            },
          ],
        },
        user,
      );

      await this.agregarLinea(manager, prestamo.id, {
        fecha: dto.fecha,
        tipo: 'ABONO',
        detalle: concepto,
        debe: 0,
        haber: monto,
        idMovimientoKardex: this.idMovimientoKardexDeRecibo(recibo),
        idRecibo: recibo.id,
        usuarioRegistro: user.usuario,
      });
    });

    return this.buscarPorId(prestamo.id);
  }

  async actualizarCuota(
    id: string,
    dto: ActualizarCuotaPrestamoDto,
    user: Usuario,
  ): Promise<PrestamoPersonal> {
    const prestamo = await this.prestamoRepository.findOne({ where: { id } });
    if (!prestamo) {
      throw new NotFoundException('No se encontró el préstamo.');
    }
    if (prestamo.estado !== 'VIGENTE') {
      throw new BadRequestException('El préstamo ya está CANCELADO.');
    }

    await this.prestamoRepository.update(prestamo.id, {
      cuotaMensual: this.r2(dto.cuotaMensual),
      observaciones: dto.observaciones?.trim() || prestamo.observaciones,
      usuarioUltimaModificacion: user.usuario,
    });

    return this.buscarPorId(prestamo.id);
  }

  async buscarPorId(id: string): Promise<PrestamoPersonal> {
    const prestamo = await this.prestamoRepository.findOne({
      where: { id },
      relations: RELACIONES,
      order: { movimientos: { numeroLinea: 'ASC' } },
    });
    if (!prestamo) {
      throw new NotFoundException('No se encontró el préstamo.');
    }
    return prestamo;
  }

  async listar(filtro: FiltroPrestamoPersonalDto) {
    const page = filtro.page ?? 1;
    const limit = filtro.limit ?? 10;

    // Bandeja liviana: de la persona solo lo que muestra la tabla; el
    // detalle completo (sub-libro, recibos) va por GET /:id.
    const qb = this.prestamoRepository
      .createQueryBuilder('p')
      .leftJoin('p.persona', 'persona')
      .addSelect([
        'persona.id',
        'persona.nombres',
        'persona.apellidoPaterno',
        'persona.apellidoMaterno',
        'persona.numeroDocumento',
      ])
      // usuarioRegistro tiene select:false en Auditoria; la bandeja muestra
      // quién generó cada préstamo (igual que recibos y traspasos).
      .addSelect('p.usuarioRegistro')
      .where('p.activo = true');

    if (filtro.idPersona) {
      qb.andWhere('p.idPersona = :idPersona', { idPersona: filtro.idPersona });
    }
    if (filtro.estado) {
      qb.andWhere('p.estado = :estado', { estado: filtro.estado });
    }

    qb.orderBy('p.fecha', 'DESC').addOrderBy('p.id', 'DESC');
    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
