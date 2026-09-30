import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { Usuario } from 'src/security/entities/usuario.entity';
import { PersonaCi } from 'src/cluster/comercio-interno/entities/persona-ci.entity';
import { ActorProductivoMinero } from 'src/cluster/parametricas/entities/actor-productivo-minero.entity';
import { DestinoGasto } from 'src/cluster/parametricas/entities/destino-gasto.entity';
import { Kardex } from '../entities/kardex.entity';
import { FondoRendir, EstadoFondoRendir } from '../entities/fondo-rendir.entity';
import { FondoRendirDetalle } from '../entities/fondo-rendir-detalle.entity';
import { CreateFondoRendirDto } from '../dto/fondo-rendir/create-fondo-rendir.dto';
import { CreateFondoRendirDetalleDto } from '../dto/fondo-rendir/create-fondo-rendir-detalle.dto';
import { FiltroFondoRendirDto } from '../dto/fondo-rendir/filtro-fondo-rendir.dto';
import { ReciboService } from './recibo.service';
import { MovimientoKardexService } from './movimiento-kardex.service';
import { KardexActividadService } from './kardex-actividad.service';

const RELACIONES = {
  persona: true,
  actorProductivoMinero: true,
  destinoGasto: true,
  recibo: true,
  movimientoKardexCierre: true,
} as const;

/**
 * Fondo a rendir cuentas (ver `FondoRendir`): entrega puntual de plata a una
 * persona o a un actor productivo minero para un propósito concreto, que se
 * va justificando con comprobantes (`FondoRendirDetalle`). La entrega
 * siempre respalda un recibo de EGRESO real (vía `ReciboService`, mismo
 * mecanismo de caja/banco que cualquier recibo); justificar no mueve plata.
 */
@Injectable()
export class FondoRendirService {
  constructor(
    @InjectRepository(FondoRendir, 'ci')
    private readonly fondoRepository: Repository<FondoRendir>,

    @InjectRepository(FondoRendirDetalle, 'ci')
    private readonly detalleRepository: Repository<FondoRendirDetalle>,

    @InjectRepository(PersonaCi, 'ci')
    private readonly personaRepository: Repository<PersonaCi>,

    @InjectRepository(ActorProductivoMinero, 'ci')
    private readonly actorRepository: Repository<ActorProductivoMinero>,

    @InjectRepository(DestinoGasto, 'ci')
    private readonly destinoGastoRepository: Repository<DestinoGasto>,

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

  private async validarDestinatario(dto: {
    idPersona?: string;
    idActorProductivoMinero?: string;
  }): Promise<void> {
    if (!dto.idPersona && !dto.idActorProductivoMinero) {
      throw new BadRequestException(
        'Debe indicar idPersona o idActorProductivoMinero.',
      );
    }
    if (dto.idPersona && dto.idActorProductivoMinero) {
      throw new BadRequestException(
        'idPersona e idActorProductivoMinero son excluyentes.',
      );
    }
    if (dto.idPersona) {
      const persona = await this.personaRepository.findOne({
        where: { id: String(dto.idPersona) },
      });
      if (!persona) {
        throw new NotFoundException('No se encontró la persona destinataria.');
      }
      if (!persona.activo) {
        throw new BadRequestException('La persona destinataria está inactiva.');
      }
    } else {
      const actor = await this.actorRepository.findOne({
        where: { id: String(dto.idActorProductivoMinero) },
      });
      if (!actor) {
        throw new NotFoundException(
          'No se encontró el actor productivo minero destinatario.',
        );
      }
      if (!actor.activo) {
        throw new BadRequestException(
          'El actor productivo minero destinatario está inactivo.',
        );
      }
    }
  }

  private async resolverDestinoGasto(
    idDestinoGasto?: number,
  ): Promise<number | null> {
    if (!idDestinoGasto) {
      return null;
    }
    const destino = await this.destinoGastoRepository.findOne({
      where: { id: idDestinoGasto },
    });
    if (!destino) {
      throw new NotFoundException('No existe el destino del gasto seleccionado.');
    }
    return destino.id;
  }

  /** Kardex ABIERTO del destinatario (PERSONAL/ASOCIADO por persona, ACTOR por actor), si tiene. */
  private async buscarKardexAbierto(fondo: FondoRendir): Promise<Kardex | null> {
    if (fondo.idPersona) {
      return this.kardexRepository.findOne({
        where: [
          { tipo: 'PERSONAL', idPersona: fondo.idPersona, estado: 'ABIERTO' },
          { tipo: 'ASOCIADO', idPersona: fondo.idPersona, estado: 'ABIERTO' },
        ],
      });
    }
    return this.kardexRepository.findOne({
      where: {
        tipo: 'ACTOR',
        idActorProductivoMinero: fondo.idActorProductivoMinero,
        estado: 'ABIERTO',
      },
    });
  }

  /** Suma de las líneas activas de un fondo. */
  private async montoJustificado(idFondoRendir: string): Promise<number> {
    const { total } = await this.detalleRepository
      .createQueryBuilder('d')
      .select('COALESCE(SUM(d.monto), 0)', 'total')
      .where('d.idFondoRendir = :id', { id: idFondoRendir })
      .andWhere('d.activo = true')
      .getRawOne<{ total: string }>();
    return this.r2(total);
  }

  private estadoSegunJustificado(
    montoEntregado: number,
    montoJustificado: number,
  ): EstadoFondoRendir {
    if (montoJustificado <= 0) return 'PENDIENTE';
    if (montoJustificado < montoEntregado) return 'RENDIDO_PARCIAL';
    if (montoJustificado === montoEntregado) return 'RENDIDO_TOTAL';
    return 'RENDIDO_EN_EXCESO';
  }

  /**
   * `saldoPendiente` (el destinatario le debe a la empresa) y
   * `montoPorReponer` (la empresa le debe a él, adelantó de su bolsillo) son
   * mutuamente excluyentes: uno de los dos siempre es 0.
   */
  private saldos(
    montoEntregado: number,
    montoJustificado: number,
  ): { saldoPendiente: number; montoPorReponer: number } {
    const diferencia = this.r2(montoEntregado - montoJustificado);
    return {
      saldoPendiente: diferencia > 0 ? diferencia : 0,
      montoPorReponer: diferencia < 0 ? this.r2(-diferencia) : 0,
    };
  }

  // ------------------------------------------------------------------ CRUD
  /**
   * Entrega el fondo: genera el recibo de EGRESO real que mueve la plata
   * (línea EFECTIVO sin idPersona/idActorProductivoMinero a propósito, para
   * NO generar automáticamente una deuda de kardex) y la cabecera del fondo.
   *
   * Nota: `ReciboService.generar` abre su propia transacción; si el insert
   * de `FondoRendir` que sigue llegara a fallar, el recibo de egreso queda
   * igual creado (huérfano de seguimiento). Es un riesgo aceptado: unificar
   * ambas operaciones en una sola transacción requeriría refactorizar
   * `ReciboService` para aceptar un `EntityManager` externo.
   */
  async entregar(dto: CreateFondoRendirDto, user: Usuario) {
    await this.validarDestinatario(dto);
    const idDestinoGasto = await this.resolverDestinoGasto(dto.idDestinoGasto);
    const monto = this.r2(Number(dto.monto));

    const recibo = await this.reciboService.generar(
      {
        tipo: 'EGRESO',
        fecha: dto.fecha,
        montoTotal: monto,
        concepto: dto.concepto.trim(),
        idFormaPago: dto.idFormaPago,
        idCuentaBancaria: dto.idCuentaBancaria,
        nroComprobante: dto.nroComprobante,
        idPersona: dto.idPersona,
        idActorProductivoMinero: dto.idActorProductivoMinero,
        idPersonaAutorizo: dto.idPersonaAutorizo,
        detalles: [
          {
            destino: 'EFECTIVO',
            monto,
            idDestinoGasto: dto.idDestinoGasto,
          },
        ],
      },
      user,
    );

    const fondo = this.fondoRepository.create({
      idPersona: dto.idPersona ?? null,
      idActorProductivoMinero: dto.idActorProductivoMinero ?? null,
      fecha: dto.fecha,
      fechaHoraEntrega: new Date(),
      concepto: dto.concepto.trim(),
      montoEntregado: monto,
      idRecibo: recibo.id,
      idDestinoGasto,
      fechaLimite: dto.fechaLimite ?? null,
      estado: 'PENDIENTE',
      usuarioRegistro: user.usuario,
    });
    const guardado = await this.fondoRepository.save(fondo);

    return this.buscarPorId(guardado.id);
  }

  /**
   * Justifica el fondo: sin `id` agrega una línea, con `id` la actualiza.
   * No mueve plata. Falla solo si el fondo ya está CERRADO_CON_DEUDA. La
   * suma de líneas activas SÍ puede superar `montoEntregado` (el
   * destinatario adelantó plata propia): ver `estadoSegunJustificado`.
   */
  async justificar(dto: CreateFondoRendirDetalleDto, user: Usuario) {
    const fondo = await this.fondoRepository.findOne({
      where: { id: String(dto.idFondoRendir) },
    });
    if (!fondo) {
      throw new NotFoundException('No se encontró el fondo a rendir.');
    }
    if (fondo.estado === 'CERRADO_CON_DEUDA') {
      throw new BadRequestException(
        'El fondo ya está cerrado con cargo a kardex: no admite más justificaciones.',
      );
    }

    let lineaExistente: FondoRendirDetalle | null = null;
    if (dto.id) {
      lineaExistente = await this.detalleRepository.findOne({
        where: { id: String(dto.id) },
      });
      if (!lineaExistente || lineaExistente.idFondoRendir !== fondo.id) {
        throw new NotFoundException(
          'No se encontró la línea de justificación indicada para este fondo.',
        );
      }
    }

    const idDestinoGasto = await this.resolverDestinoGasto(dto.idDestinoGasto);
    const monto = this.r2(Number(dto.monto));

    // Lo justificado SÍ puede superar lo entregado (el destinatario adelantó
    // plata propia): no hay tope acá, ver `estadoSegunJustificado` y
    // `montoPorReponer`.

    if (lineaExistente) {
      await this.detalleRepository.update(lineaExistente.id, {
        fecha: dto.fecha,
        concepto: dto.concepto.trim(),
        monto,
        nroComprobante: dto.nroComprobante?.trim() || null,
        facturaRecibo: dto.facturaRecibo?.trim() || null,
        idDestinoGasto,
        usuarioUltimaModificacion: user.usuario,
      });
    } else {
      await this.detalleRepository.save(
        this.detalleRepository.create({
          idFondoRendir: fondo.id,
          fecha: dto.fecha,
          concepto: dto.concepto.trim(),
          monto,
          nroComprobante: dto.nroComprobante?.trim() || null,
          facturaRecibo: dto.facturaRecibo?.trim() || null,
          idDestinoGasto,
          usuarioRegistro: user.usuario,
        }),
      );
    }

    // Recalcula el estado desde la suma real de líneas activas en BD (fuente
    // de verdad), en vez de reusar `justificadoNuevo`: si la línea editada
    // sigue inactiva, ese número no aplica y el estado no debe cambiar por
    // esta edición.
    const justificadoFinal = await this.montoJustificado(fondo.id);
    await this.fondoRepository.update(fondo.id, {
      estado: this.estadoSegunJustificado(Number(fondo.montoEntregado), justificadoFinal),
      usuarioUltimaModificacion: user.usuario,
    });

    return this.buscarPorId(fondo.id);
  }

  /** Activa/desactiva una línea de justificación y recalcula el estado del fondo. */
  async cambiarEstadoDetalle(id: string, activo: boolean, user: Usuario) {
    const linea = await this.detalleRepository.findOne({ where: { id } });
    if (!linea) {
      throw new NotFoundException('No se encontró la línea de justificación.');
    }
    const fondo = await this.fondoRepository.findOne({
      where: { id: linea.idFondoRendir },
    });
    if (!fondo) {
      throw new NotFoundException('No se encontró el fondo a rendir.');
    }
    if (fondo.estado === 'CERRADO_CON_DEUDA') {
      throw new BadRequestException(
        'El fondo ya está cerrado con cargo a kardex: no se puede modificar.',
      );
    }

    await this.detalleRepository.update(linea.id, {
      activo,
      usuarioUltimaModificacion: user.usuario,
    });

    const justificado = await this.montoJustificado(fondo.id);
    await this.fondoRepository.update(fondo.id, {
      estado: this.estadoSegunJustificado(Number(fondo.montoEntregado), justificado),
      usuarioUltimaModificacion: user.usuario,
    });

    return this.buscarPorId(fondo.id);
  }

  /**
   * Carga el saldo sin justificar al kardex personal del destinatario: acción
   * manual y explícita (no automática), pensada para cuando ya pasó tiempo
   * y no se espera más justificación ni devolución. Genera una línea DEBE
   * en el kardex ABIERTO del destinatario por el saldo pendiente — sin
   * generar ningún movimiento nuevo de caja/banco, esa plata ya salió al
   * entregar el fondo. Deja el fondo en estado terminal CERRADO_CON_DEUDA.
   */
  async cerrarConDeuda(id: string, user: Usuario): Promise<FondoRendir> {
    const fondo = await this.fondoRepository.findOne({ where: { id } });
    if (!fondo) {
      throw new NotFoundException('No se encontró el fondo a rendir.');
    }
    if (fondo.estado === 'CERRADO_CON_DEUDA') {
      throw new BadRequestException('El fondo ya está cerrado con cargo a kardex.');
    }

    const justificado = await this.montoJustificado(fondo.id);
    const { saldoPendiente, montoPorReponer } = this.saldos(
      Number(fondo.montoEntregado),
      justificado,
    );
    if (saldoPendiente <= 0) {
      throw new BadRequestException(
        montoPorReponer > 0
          ? `Este fondo está justificado en exceso: la empresa le debe reponer ${montoPorReponer} al destinatario, no hay saldo pendiente que cargarle a su kardex.`
          : 'Este fondo ya está totalmente justificado: no tiene saldo pendiente que cargar a kardex.',
      );
    }

    const kardex = await this.buscarKardexAbierto(fondo);
    if (!kardex) {
      throw new BadRequestException(
        'El destinatario no tiene un kardex ABIERTO. Abrí uno (POST /contabilidad/kardex) antes de cargarle esta deuda.',
      );
    }
    await this.kardexActividadService.validarActivo(kardex);

    return this.dataSource.transaction(async (manager) => {
      const movKardex =
        await this.movimientoKardexService.crearLineaSinMovimientoDineroEnTransaccion(
          manager,
          kardex,
          {
            fecha: this.hoy(),
            detalle: `SALDO SIN JUSTIFICAR - FONDO A RENDIR N° ${fondo.id} (${fondo.concepto})`,
            idDestinoGasto: fondo.idDestinoGasto,
            debe: saldoPendiente,
            haber: 0,
            usuarioRegistro: user.usuario,
          },
        );

      await manager.update(FondoRendir, fondo.id, {
        estado: 'CERRADO_CON_DEUDA',
        idMovimientoKardexCierre: movKardex.id,
        usuarioUltimaModificacion: user.usuario,
      });

      return manager.findOne(FondoRendir, {
        where: { id: fondo.id },
        relations: RELACIONES,
      });
    });
  }

  private hoy(): string {
    return new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString().slice(0, 10);
  }

  async buscarPorId(id: string) {
    const fondo = await this.fondoRepository.findOne({
      where: { id },
      relations: { ...RELACIONES, detalles: { destinoGasto: true } },
    });
    if (!fondo) {
      throw new NotFoundException('No se encontró el fondo a rendir.');
    }
    const montoJustificado = await this.montoJustificado(fondo.id);
    return {
      ...fondo,
      montoJustificado,
      ...this.saldos(Number(fondo.montoEntregado), montoJustificado),
    };
  }

  async listar(filtro: FiltroFondoRendirDto) {
    const page = filtro.page ?? 1;
    const limit = filtro.limit ?? 10;

    const qb = this.fondoRepository
      .createQueryBuilder('f')
      .leftJoinAndSelect('f.persona', 'persona')
      .leftJoinAndSelect('f.actorProductivoMinero', 'actor')
      .leftJoinAndSelect('f.destinoGasto', 'destino')
      // Solo lo que necesita la bandeja para imprimir el recibo de entrega.
      .leftJoin('f.recibo', 'rec')
      .addSelect(['rec.id', 'rec.serie', 'rec.numero', 'rec.estado'])
      // usuarioRegistro tiene select:false en Auditoria; la bandeja muestra
      // quién generó cada fondo (igual que en recibos y traspasos).
      .addSelect('f.usuarioRegistro');

    if (filtro.idPersona) {
      qb.andWhere('f.idPersona = :idPersona', { idPersona: filtro.idPersona });
    }
    if (filtro.idActorProductivoMinero) {
      qb.andWhere('f.idActorProductivoMinero = :idActor', {
        idActor: filtro.idActorProductivoMinero,
      });
    }
    if (filtro.estado) {
      qb.andWhere('f.estado = :estado', { estado: filtro.estado });
    }
    if (filtro.fechaDesde) {
      qb.andWhere('f.fecha >= :desde', { desde: filtro.fechaDesde });
    }
    if (filtro.fechaHasta) {
      qb.andWhere('f.fecha <= :hasta', { hasta: filtro.fechaHasta });
    }

    qb.orderBy('f.fecha', 'DESC').addOrderBy('f.id', 'DESC');
    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();

    // Trae el justificado de todos los fondos de la página en una sola
    // consulta (evita N+1).
    const ids = data.map((f) => f.id);
    const justificados = new Map<string, number>();
    if (ids.length > 0) {
      const filas = await this.detalleRepository
        .createQueryBuilder('d')
        .select('d.idFondoRendir', 'idFondoRendir')
        .addSelect('COALESCE(SUM(d.monto), 0)', 'total')
        .where('d.idFondoRendir IN (:...ids)', { ids })
        .andWhere('d.activo = true')
        .groupBy('d.idFondoRendir')
        .getRawMany<{ idFondoRendir: string; total: string }>();
      for (const f of filas) {
        justificados.set(f.idFondoRendir, this.r2(f.total));
      }
    }

    const dataConSaldo = data.map((f) => {
      const montoJustificado = justificados.get(f.id) ?? 0;
      return {
        ...f,
        montoJustificado,
        ...this.saldos(Number(f.montoEntregado), montoJustificado),
      };
    });

    return {
      data: dataConSaldo,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
