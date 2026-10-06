import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';

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
import { ReponerFondoRendirDto } from '../dto/fondo-rendir/reponer-fondo-rendir.dto';
import { ReciboService } from './recibo.service';
import { MovimientoKardexService } from './movimiento-kardex.service';
import { KardexActividadService } from './kardex-actividad.service';

const RELACIONES = {
  persona: true,
  actorProductivoMinero: true,
  destinoGasto: true,
  recibo: true,
  reciboReposicion: true,
  movimientoKardexCierre: true,
} as const;

/** Lo que define a quién pertenece un fondo y cuánto de su excedente ya se saldó. */
type FondoSaldable = Pick<FondoRendir, 'montoEntregado' | 'montoRepuesto' | 'montoCompensado'>;
type Destinatario = Pick<FondoRendir, 'idPersona' | 'idActorProductivoMinero'>;

/**
 * Fondo a rendir cuentas (ver `FondoRendir`): entrega puntual de plata a una
 * persona o a un actor productivo minero para un propósito concreto, que se
 * va justificando con comprobantes (`FondoRendirDetalle`). La entrega
 * siempre respalda un recibo de EGRESO real (vía `ReciboService`, mismo
 * mecanismo de caja/banco que cualquier recibo); justificar no mueve plata.
 *
 * Cómo se cierra cada caso:
 *   - Justificó de menos: `cerrarConDeuda` (el saldo va a su kardex) o
 *     `rendirSinComprobantes` (se da por rendido tal cual).
 *   - Justificó de más: `reponer` (se le devuelve con un recibo de egreso) o,
 *     si no se le devuelve, `aplicarSaldoFavor` (el excedente entra como ya
 *     justificado en su siguiente fondo; es automático al entregarlo).
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

  /** Suma de las líneas activas de un fondo (dentro de `manager` si se está en una transacción). */
  private async montoJustificado(
    idFondoRendir: string,
    manager?: EntityManager,
  ): Promise<number> {
    const repo = manager
      ? manager.getRepository(FondoRendirDetalle)
      : this.detalleRepository;
    const { total } = await repo
      .createQueryBuilder('d')
      .select('COALESCE(SUM(d.monto), 0)', 'total')
      .where('d.idFondoRendir = :id', { id: idFondoRendir })
      .andWhere('d.activo = true')
      .getRawOne<{ total: string }>();
    return this.r2(total);
  }

  /**
   * `saldoPendiente` (el destinatario le debe a la empresa) y
   * `montoPorReponer` (la empresa le debe a él, adelantó de su bolsillo) son
   * mutuamente excluyentes: uno de los dos siempre es 0. Del excedente se
   * descuenta lo que ya se le devolvió (`montoRepuesto`) y lo que se aplicó
   * como saldo a favor en un fondo posterior (`montoCompensado`).
   */
  private saldos(
    fondo: FondoSaldable,
    montoJustificado: number,
  ): { saldoPendiente: number; montoPorReponer: number } {
    const diferencia = this.r2(Number(fondo.montoEntregado) - montoJustificado);
    if (diferencia >= 0) {
      return { saldoPendiente: diferencia, montoPorReponer: 0 };
    }
    const porReponer = this.r2(
      -diferencia - Number(fondo.montoRepuesto ?? 0) - Number(fondo.montoCompensado ?? 0),
    );
    return { saldoPendiente: 0, montoPorReponer: porReponer > 0 ? porReponer : 0 };
  }

  private estadoSegunJustificado(
    fondo: FondoSaldable,
    montoJustificado: number,
  ): EstadoFondoRendir {
    if (montoJustificado <= 0) return 'PENDIENTE';
    const { saldoPendiente, montoPorReponer } = this.saldos(fondo, montoJustificado);
    if (saldoPendiente > 0) return 'RENDIDO_PARCIAL';
    // Excedente ya repuesto o compensado => no queda nada pendiente de ningún lado.
    return montoPorReponer > 0 ? 'RENDIDO_EN_EXCESO' : 'RENDIDO_TOTAL';
  }

  /** true si el excedente del fondo ya se repuso o se aplicó a otro fondo. */
  private excedenteSaldado(fondo: FondoSaldable): boolean {
    return Number(fondo.montoRepuesto ?? 0) > 0 || Number(fondo.montoCompensado ?? 0) > 0;
  }

  /**
   * Con el excedente ya repuesto/compensado, cambiar los comprobantes
   * descuadraría esa devolución: el fondo queda congelado.
   */
  private validarExcedenteSinSaldar(fondo: FondoSaldable): void {
    if (this.excedenteSaldado(fondo)) {
      throw new BadRequestException(
        'El excedente de este fondo ya se repuso o se aplicó como saldo a favor en otro fondo: no admite cambios en sus comprobantes.',
      );
    }
  }

  /**
   * Fondos del destinatario que siguen RENDIDO_EN_EXCESO (la empresa todavía
   * le debe), con lo que falta reponer de cada uno, del más antiguo al más
   * nuevo. `excluirId` deja afuera al fondo que va a recibir ese saldo.
   */
  private async fondosConSaldoFavor(
    destinatario: Destinatario,
    excluirId?: string,
    manager?: EntityManager,
  ): Promise<Array<{ fondo: FondoRendir; montoPorReponer: number }>> {
    const repo = manager ? manager.getRepository(FondoRendir) : this.fondoRepository;
    const candidatos = await repo.find({
      where: {
        estado: 'RENDIDO_EN_EXCESO',
        ...(destinatario.idPersona
          ? { idPersona: destinatario.idPersona }
          : { idActorProductivoMinero: destinatario.idActorProductivoMinero }),
      },
      order: { id: 'ASC' },
    });
    const conSaldo: Array<{ fondo: FondoRendir; montoPorReponer: number }> = [];
    for (const fondo of candidatos) {
      if (fondo.id === excluirId) continue;
      const justificado = await this.montoJustificado(fondo.id, manager);
      const { montoPorReponer } = this.saldos(fondo, justificado);
      if (montoPorReponer > 0) {
        conSaldo.push({ fondo, montoPorReponer });
      }
    }
    return conSaldo;
  }

  /**
   * Pasa el saldo a favor de los fondos anteriores del destinatario al fondo
   * `destino`: por cada uno agrega una línea SALDO_FAVOR ya justificada y
   * deja al de origen en RENDIDO_TOTAL (excedente compensado). No mueve
   * plata. Devuelve el total aplicado (0 si no tenía saldo a favor).
   */
  private async aplicarSaldoFavorEnTransaccion(
    manager: EntityManager,
    destino: FondoRendir,
    user: Usuario,
  ): Promise<number> {
    const origenes = await this.fondosConSaldoFavor(destino, destino.id, manager);
    let aplicado = 0;
    for (const { fondo: origen, montoPorReponer } of origenes) {
      await manager.save(
        manager.create(FondoRendirDetalle, {
          idFondoRendir: destino.id,
          fecha: destino.fecha,
          concepto: `SALDO A FAVOR DEL FONDO A RENDIR N° ${origen.id} (${origen.concepto})`.slice(0, 255),
          monto: montoPorReponer,
          tipo: 'SALDO_FAVOR',
          idFondoOrigen: origen.id,
          idDestinoGasto: origen.idDestinoGasto ?? null,
          usuarioRegistro: user.usuario,
        }),
      );
      await manager.update(FondoRendir, origen.id, {
        montoCompensado: this.r2(Number(origen.montoCompensado ?? 0) + montoPorReponer),
        idFondoCompensacion: destino.id,
        estado: 'RENDIDO_TOTAL',
        usuarioUltimaModificacion: user.usuario,
      });
      aplicado = this.r2(aplicado + montoPorReponer);
    }
    if (aplicado > 0) {
      const justificado = await this.montoJustificado(destino.id, manager);
      await manager.update(FondoRendir, destino.id, {
        estado: this.estadoSegunJustificado(destino, justificado),
        usuarioUltimaModificacion: user.usuario,
      });
    }
    return aplicado;
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
    // Si el destinatario tenía saldo a favor de fondos anteriores (justificó
    // de más y no se le repuso), entra a este fondo como ya justificado.
    const idFondo = await this.dataSource.transaction(async (manager) => {
      const guardado = await manager.save(fondo);
      await this.aplicarSaldoFavorEnTransaccion(manager, guardado, user);
      return guardado.id;
    });

    return this.buscarPorId(idFondo);
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
    this.validarExcedenteSinSaldar(fondo);

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
      if (lineaExistente.tipo !== 'COMPROBANTE') {
        throw new BadRequestException(
          'Esta línea la generó el sistema (saldo a favor o rendido sin comprobantes): no se puede editar.',
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
      estado: this.estadoSegunJustificado(fondo, justificadoFinal),
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
    this.validarExcedenteSinSaldar(fondo);
    if (linea.tipo === 'SALDO_FAVOR') {
      throw new BadRequestException(
        'Esta línea es el saldo a favor de un fondo anterior ya compensado: no se puede anular.',
      );
    }

    await this.detalleRepository.update(linea.id, {
      activo,
      usuarioUltimaModificacion: user.usuario,
    });

    const justificado = await this.montoJustificado(fondo.id);
    await this.fondoRepository.update(fondo.id, {
      estado: this.estadoSegunJustificado(fondo, justificado),
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
    const { saldoPendiente, montoPorReponer } = this.saldos(fondo, justificado);
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

  /**
   * Da por rendido el fondo SIN cargar comprobantes: agrega una línea
   * SIN_COMPROBANTE por todo el saldo pendiente y el fondo queda en
   * RENDIDO_TOTAL. No mueve plata ni toca el kardex. Sirve con el fondo
   * PENDIENTE (nada justificado) o RENDIDO_PARCIAL (cubre lo que faltaba).
   * Se deshace anulando esa línea.
   */
  async rendirSinComprobantes(id: string, user: Usuario) {
    const fondo = await this.fondoRepository.findOne({ where: { id } });
    if (!fondo) {
      throw new NotFoundException('No se encontró el fondo a rendir.');
    }
    if (fondo.estado === 'CERRADO_CON_DEUDA') {
      throw new BadRequestException('El fondo ya está cerrado con cargo a kardex.');
    }
    const justificado = await this.montoJustificado(fondo.id);
    const { saldoPendiente } = this.saldos(fondo, justificado);
    if (saldoPendiente <= 0) {
      throw new BadRequestException(
        'Este fondo no tiene saldo pendiente de justificar: ya está rendido.',
      );
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.save(
        manager.create(FondoRendirDetalle, {
          idFondoRendir: fondo.id,
          fecha: this.hoy(),
          concepto: 'RENDIDO SIN COMPROBANTES',
          monto: saldoPendiente,
          tipo: 'SIN_COMPROBANTE',
          idDestinoGasto: fondo.idDestinoGasto ?? null,
          usuarioRegistro: user.usuario,
        }),
      );
      await manager.update(FondoRendir, fondo.id, {
        estado: 'RENDIDO_TOTAL',
        usuarioUltimaModificacion: user.usuario,
      });
    });

    return this.buscarPorId(fondo.id);
  }

  /**
   * Le devuelve al destinatario el excedente de un fondo RENDIDO_EN_EXCESO
   * (lo que puso de su bolsillo): genera un recibo de EGRESO real por
   * `montoPorReponer` — efectivo sale de la caja de flujo, medio bancario
   * de la libreta, igual que la entrega — con concepto de devolución, y deja
   * el fondo en RENDIDO_TOTAL. Recibo y fondo van en la misma transacción.
   */
  async reponer(id: string, dto: ReponerFondoRendirDto, user: Usuario) {
    const fondo = await this.fondoRepository.findOne({ where: { id } });
    if (!fondo) {
      throw new NotFoundException('No se encontró el fondo a rendir.');
    }
    const justificado = await this.montoJustificado(fondo.id);
    const { montoPorReponer } = this.saldos(fondo, justificado);
    if (montoPorReponer <= 0) {
      throw new BadRequestException(
        'Este fondo no tiene excedente por reponer al destinatario.',
      );
    }

    await this.dataSource.transaction(async (manager) => {
      const recibo = await this.reciboService.generarEnTransaccion(
        manager,
        {
          tipo: 'EGRESO',
          fecha: dto.fecha,
          montoTotal: montoPorReponer,
          concepto: `DEVOLUCIÓN POR EXCESO EN RENDICIÓN - FONDO A RENDIR N° ${fondo.id} (${fondo.concepto})`.slice(0, 255),
          idFormaPago: dto.idFormaPago,
          idCuentaBancaria: dto.idCuentaBancaria,
          nroComprobante: dto.nroComprobante,
          idPersona: fondo.idPersona ?? undefined,
          idActorProductivoMinero: fondo.idActorProductivoMinero ?? undefined,
          idPersonaAutorizo: dto.idPersonaAutorizo,
          detalles: [
            {
              destino: 'EFECTIVO',
              monto: montoPorReponer,
              idDestinoGasto: dto.idDestinoGasto ?? fondo.idDestinoGasto ?? undefined,
            },
          ],
        },
        user,
      );

      await manager.update(FondoRendir, fondo.id, {
        montoRepuesto: this.r2(Number(fondo.montoRepuesto ?? 0) + montoPorReponer),
        idReciboReposicion: recibo.id,
        fechaReposicion: dto.fecha,
        estado: 'RENDIDO_TOTAL',
        usuarioUltimaModificacion: user.usuario,
      });
    });

    return this.buscarPorId(fondo.id);
  }

  /**
   * Aplica a este fondo el saldo a favor que el destinatario arrastra de
   * fondos anteriores. Al entregar un fondo nuevo esto ya ocurre solo; el
   * endpoint queda para los fondos entregados antes de que existiera la
   * regla. Solo con el fondo PENDIENTE o RENDIDO_PARCIAL.
   */
  async aplicarSaldoFavor(id: string, user: Usuario) {
    const fondo = await this.fondoRepository.findOne({ where: { id } });
    if (!fondo) {
      throw new NotFoundException('No se encontró el fondo a rendir.');
    }
    if (fondo.estado !== 'PENDIENTE' && fondo.estado !== 'RENDIDO_PARCIAL') {
      throw new BadRequestException(
        'Solo se puede aplicar saldo a favor a un fondo pendiente o rendido parcialmente.',
      );
    }

    const aplicado = await this.dataSource.transaction((manager) =>
      this.aplicarSaldoFavorEnTransaccion(manager, fondo, user),
    );
    if (aplicado <= 0) {
      throw new BadRequestException(
        'El destinatario no tiene saldo a favor de fondos anteriores.',
      );
    }

    return this.buscarPorId(fondo.id);
  }

  /** Saldo a favor del destinatario (lo que la empresa aún le debe reponer), con el detalle por fondo. */
  async saldoFavor(filtro: { idPersona?: string; idActorProductivoMinero?: string }) {
    if (!filtro.idPersona === !filtro.idActorProductivoMinero) {
      throw new BadRequestException(
        'Debe indicar idPersona o idActorProductivoMinero (solo uno).',
      );
    }
    const fondos = await this.fondosConSaldoFavor({
      idPersona: filtro.idPersona ?? null,
      idActorProductivoMinero: filtro.idActorProductivoMinero ?? null,
    });
    return {
      saldoFavor: this.r2(fondos.reduce((s, f) => s + f.montoPorReponer, 0)),
      fondos: fondos.map(({ fondo, montoPorReponer }) => ({
        id: fondo.id,
        fecha: fondo.fecha,
        concepto: fondo.concepto,
        montoPorReponer,
      })),
    };
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
    // Lo que el destinatario tiene a favor en OTROS fondos y se podría
    // aplicar a este (solo tiene sentido mientras le falte justificar).
    const saldoFavorDisponible =
      fondo.estado === 'PENDIENTE' || fondo.estado === 'RENDIDO_PARCIAL'
        ? this.r2(
            (await this.fondosConSaldoFavor(fondo, fondo.id)).reduce(
              (s, f) => s + f.montoPorReponer,
              0,
            ),
          )
        : 0;
    return {
      ...fondo,
      montoJustificado,
      ...this.saldos(fondo, montoJustificado),
      saldoFavorDisponible,
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
      // Ídem para el recibo de devolución del excedente, si lo hubo.
      .leftJoin('f.reciboReposicion', 'rrep')
      .addSelect(['rrep.id', 'rrep.serie', 'rrep.numero', 'rrep.estado'])
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
        ...this.saldos(f, montoJustificado),
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
