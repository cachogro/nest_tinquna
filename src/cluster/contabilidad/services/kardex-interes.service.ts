import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In } from 'typeorm';

import { Usuario } from 'src/security/entities/usuario.entity';
import { Kardex, ResumenInteresKardex } from '../entities/kardex.entity';
import { MovimientoKardex } from '../entities/movimiento-kardex.entity';
import { KardexInteres } from '../entities/kardex-interes.entity';
import { KardexInteresCuota } from '../entities/kardex-interes-cuota.entity';
import {
  KardexInteresEvento,
  TipoKardexInteresEvento,
} from '../entities/kardex-interes-evento.entity';
import { AplicarKardexInteresDto } from '../dto/kardex-interes/aplicar-kardex-interes.dto';
import { CambiarTasaKardexInteresDto } from '../dto/kardex-interes/cambiar-tasa-kardex-interes.dto';
import { CondonarKardexInteresDto } from '../dto/kardex-interes/condonar-kardex-interes.dto';
import { CargarKardexInteresDto } from '../dto/kardex-interes/cargar-kardex-interes.dto';
import { ObservacionKardexInteresDto } from '../dto/kardex-interes/observacion-kardex-interes.dto';
import { KardexActividadService } from './kardex-actividad.service';
import { MovimientoKardexService } from './movimiento-kardex.service';

/** Usuario de las cuotas que se generan solas al consultar. */
const USUARIO_SISTEMA = 'sistema';
/** Tope de meses a generar de una vez (50 años): corta una fecha mal cargada. */
const MAX_CUOTAS = 600;

interface Periodo {
  fechaDesde: string;
  fechaCorte: string;
  saldoBase: number;
}

export interface DetalleInteresKardex {
  kardex: Pick<Kardex, 'id' | 'codigo' | 'tipo' | 'estado' | 'saldoActual'>;
  resumen: ResumenInteresKardex | null;
  /** Plan que sigue generando cuotas, con sus cuotas y su bitácora. */
  vigente: KardexInteres | null;
  /** Todos los planes del kardex, el más reciente primero. */
  planes: KardexInteres[];
}

/**
 * Intereses por mora sobre un kardex ACTOR, ASOCIADO o PERSONAL.
 *
 * El interés es MENSUAL y SIMPLE sobre el saldo del kardex: la cuota del mes
 * N = saldo del kardex al día de corte (fechaInicio + N meses) x tasa / 100.
 * Se lleva APARTE (kardex_interes_cuota) y no toca el saldo del kardex
 * mientras está PENDIENTE, porque es negociable al momento de cobrar:
 *   - bajar la tasa  -> `cambiarTasa`: recalcula todas las cuotas pendientes;
 *   - perdonarlo     -> `condonar`: las cuotas pendientes no se cobran;
 *   - cobrarlo       -> `cargar`: las pendientes pasan al kardex como UNA
 *                       línea DEBE sin movimiento de dinero, y de ahí se
 *                       cobra con un recibo como cualquier otra deuda.
 *
 * No hay proceso programado: las cuotas se generan (y las pendientes se
 * refrescan contra el kardex) cada vez que se consulta, igual que la
 * actividad del kardex. Así un movimiento corregido o cargado con fecha
 * pasada también corrige el interés de los meses que todavía no se cargaron.
 */
@Injectable()
export class KardexInteresService {
  constructor(
    @InjectDataSource('ci')
    private readonly dataSource: DataSource,

    private readonly movimientoKardexService: MovimientoKardexService,
    private readonly kardexActividadService: KardexActividadService,
  ) {}

  // ------------------------------------------------------------------ helpers
  private r2(n: number): number {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  private hoy(): string {
    return new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString().slice(0, 10);
  }

  /** Las columnas `date` pueden llegar como string o Date según el driver. */
  private iso(fecha: string | Date): string {
    return fecha instanceof Date ? fecha.toISOString().slice(0, 10) : String(fecha).slice(0, 10);
  }

  private texto(fecha: string): string {
    const [anio, mes, dia] = fecha.split('-');
    return `${dia}/${mes}/${anio}`;
  }

  /** Mismo día N meses después; si el mes no lo tiene (31, 30, 29), su último día. */
  private sumarMeses(fecha: string, meses: number): string {
    const [anio, mes, dia] = fecha.split('-').map(Number);
    const total = mes - 1 + meses;
    const anioDestino = anio + Math.floor(total / 12);
    const mesDestino = total % 12;
    const ultimoDia = new Date(Date.UTC(anioDestino, mesDestino + 1, 0)).getUTCDate();
    return new Date(Date.UTC(anioDestino, mesDestino, Math.min(dia, ultimoDia)))
      .toISOString()
      .slice(0, 10);
  }

  private normalizar(valor?: string | null): string | null {
    const limpio = valor?.trim().toUpperCase();
    return limpio ? limpio : null;
  }

  private tasaTexto(tasa: number): string {
    return String(Number(Number(tasa).toFixed(4)));
  }

  private async obtenerPlan(manager: EntityManager, id: string): Promise<KardexInteres> {
    const plan = await manager.findOne(KardexInteres, {
      where: { id, activo: true },
      relations: { kardex: true },
    });
    if (!plan) {
      throw new NotFoundException('No se encontró el plan de intereses.');
    }
    return plan;
  }

  private async registrarEvento(
    manager: EntityManager,
    plan: KardexInteres,
    tipo: TipoKardexInteresEvento,
    user: Usuario,
    datos: Partial<KardexInteresEvento> = {},
  ): Promise<void> {
    await manager.save(
      manager.create(KardexInteresEvento, {
        idKardexInteres: plan.id,
        tipo,
        fecha: this.hoy(),
        ...datos,
        observacion: this.normalizar(datos.observacion),
        usuarioRegistro: user.usuario,
      }),
    );
  }

  private async cuotasPendientes(
    manager: EntityManager,
    plan: KardexInteres,
  ): Promise<KardexInteresCuota[]> {
    return manager.find(KardexInteresCuota, {
      where: { idKardexInteres: plan.id, estado: 'PENDIENTE' },
      order: { numero: 'ASC' },
    });
  }

  private total(cuotas: KardexInteresCuota[]): number {
    return this.r2(cuotas.reduce((suma, c) => suma + Number(c.monto), 0));
  }

  /**
   * Meses ya cumplidos de un plan VIGENTE con el saldo del kardex al día de
   * corte de cada uno (saldo inicial + DEBE - HABER de las líneas activas
   * hasta ese día; un saldo a favor del deudor no genera interés).
   */
  private async periodosCumplidos(
    manager: EntityManager,
    plan: KardexInteres,
  ): Promise<Map<number, Periodo>> {
    const periodos = new Map<number, Periodo>();
    const inicio = this.iso(plan.fechaInicio);
    const hoy = this.hoy();
    if (this.sumarMeses(inicio, 1) > hoy) {
      return periodos;
    }

    const kardex = await manager.findOne(Kardex, { where: { id: plan.idKardex } });
    const movimientos = await manager.find(MovimientoKardex, {
      where: { idKardex: plan.idKardex, activo: true },
      select: { id: true, fecha: true, debe: true, haber: true },
    });
    const lineas = movimientos.map((m) => ({
      fecha: this.iso(m.fecha),
      importe: Number(m.debe) - Number(m.haber),
    }));

    for (let numero = 1; numero <= MAX_CUOTAS; numero++) {
      const fechaCorte = this.sumarMeses(inicio, numero);
      if (fechaCorte > hoy) break;
      const saldo = lineas
        .filter((l) => l.fecha <= fechaCorte)
        .reduce((suma, l) => suma + l.importe, Number(kardex?.saldoInicial ?? 0));
      periodos.set(numero, {
        fechaDesde: this.sumarMeses(inicio, numero - 1),
        fechaCorte,
        saldoBase: Math.max(0, this.r2(saldo)),
      });
    }
    return periodos;
  }

  /**
   * Pone al día un plan: genera las cuotas de los meses cumplidos que falten
   * (solo si está VIGENTE) y recalcula las PENDIENTES con la tasa actual del
   * plan. Las CARGADAS y CONDONADAS no se tocan. En un plan FINALIZADO las
   * pendientes conservan su saldo base. Llamar dentro de una transacción.
   */
  private async sincronizar(
    manager: EntityManager,
    plan: KardexInteres,
    usuario = USUARIO_SISTEMA,
  ): Promise<void> {
    // Dos consultas simultáneas no deben generar la misma cuota.
    await manager.query(
      `SELECT pg_advisory_xact_lock(hashtext('contabilidad.kardex_interes.' || $1))`,
      [String(plan.id)],
    );
    const cuotas = await manager.find(KardexInteresCuota, {
      where: { idKardexInteres: plan.id },
    });
    const existentes = new Map(cuotas.map((c) => [c.numero, c]));
    const periodos =
      plan.estado === 'VIGENTE'
        ? await this.periodosCumplidos(manager, plan)
        : new Map<number, Periodo>();
    const tasa = Number(plan.tasaMensual);

    for (const [numero, periodo] of periodos) {
      if (existentes.has(numero)) continue;
      await manager.save(
        manager.create(KardexInteresCuota, {
          idKardexInteres: plan.id,
          numero,
          ...periodo,
          tasa,
          monto: this.r2((periodo.saldoBase * tasa) / 100),
          estado: 'PENDIENTE',
          usuarioRegistro: usuario,
        }),
      );
    }

    for (const cuota of cuotas) {
      if (cuota.estado !== 'PENDIENTE') continue;
      const saldoBase = periodos.get(cuota.numero)?.saldoBase ?? Number(cuota.saldoBase);
      const monto = this.r2((saldoBase * tasa) / 100);
      if (
        Number(cuota.saldoBase) !== saldoBase ||
        Number(cuota.tasa) !== tasa ||
        Number(cuota.monto) !== monto
      ) {
        await manager.update(KardexInteresCuota, cuota.id, {
          saldoBase,
          tasa,
          monto,
          usuarioUltimaModificacion: usuario,
        });
      }
    }
  }

  private resumir(
    kardex: Kardex,
    planes: KardexInteres[],
    cuotas: KardexInteresCuota[],
  ): ResumenInteresKardex | null {
    if (planes.length === 0) {
      return null;
    }
    const vigente = planes.find((p) => p.estado === 'VIGENTE') ?? null;
    // Sin plan vigente se muestra el último que tuvo.
    const referencia =
      vigente ?? [...planes].sort((a, b) => Number(b.id) - Number(a.id))[0];
    const suma = (estado: KardexInteresCuota['estado']) =>
      this.total(cuotas.filter((c) => c.estado === estado));
    const pendiente = suma('PENDIENTE');

    let proximoCorte: string | null = null;
    if (vigente) {
      const generadas = cuotas.filter(
        (c) => String(c.idKardexInteres) === String(vigente.id),
      ).length;
      proximoCorte = this.sumarMeses(this.iso(vigente.fechaInicio), generadas + 1);
    }

    return {
      idKardexInteres: vigente ? String(vigente.id) : null,
      estado: vigente ? 'VIGENTE' : 'FINALIZADO',
      tasaMensual: Number(referencia.tasaMensual),
      fechaInicio: this.iso(referencia.fechaInicio),
      proximoCorte,
      cuotasPendientes: cuotas.filter((c) => c.estado === 'PENDIENTE').length,
      pendiente,
      cargado: suma('CARGADO'),
      condonado: suma('CONDONADO'),
      totalConIntereses: this.r2(Number(kardex.saldoActual) + pendiente),
    };
  }

  // ------------------------------------------------------------------ consultas
  /**
   * Resumen de intereses de cada kardex, por id (los que nunca tuvieron
   * interés no aparecen). Pone al día los planes vigentes antes de sumar.
   */
  async resumenes(kardexs: Kardex[]): Promise<Map<string, ResumenInteresKardex>> {
    const resultado = new Map<string, ResumenInteresKardex>();
    if (kardexs.length === 0) {
      return resultado;
    }
    const planes = await this.dataSource.manager.find(KardexInteres, {
      where: { idKardex: In(kardexs.map((k) => String(k.id))), activo: true },
    });
    if (planes.length === 0) {
      return resultado;
    }
    for (const plan of planes.filter((p) => p.estado === 'VIGENTE')) {
      await this.dataSource.transaction((manager) => this.sincronizar(manager, plan));
    }
    const cuotas = await this.dataSource.manager.find(KardexInteresCuota, {
      where: { idKardexInteres: In(planes.map((p) => p.id)) },
    });

    for (const kardex of kardexs) {
      const suyos = planes.filter((p) => String(p.idKardex) === String(kardex.id));
      const ids = new Set(suyos.map((p) => String(p.id)));
      const resumen = this.resumir(
        kardex,
        suyos,
        cuotas.filter((c) => ids.has(String(c.idKardexInteres))),
      );
      if (resumen) {
        resultado.set(String(kardex.id), resumen);
      }
    }
    return resultado;
  }

  /** Completa `kardex.interes` en cada elemento (para listados y detalle). */
  async completar<T extends Kardex>(kardexs: T[]): Promise<T[]> {
    const resumenes = await this.resumenes(kardexs);
    kardexs.forEach((k) => (k.interes = resumenes.get(String(k.id)) ?? null));
    return kardexs;
  }

  /** Sección de intereses de un kardex: resumen, plan vigente e historial. */
  async detalle(idKardex: string): Promise<DetalleInteresKardex> {
    const kardex = await this.dataSource.manager.findOne(Kardex, {
      where: { id: idKardex },
    });
    if (!kardex) {
      throw new NotFoundException('No se encontró el kardex.');
    }
    const resumen = (await this.resumenes([kardex])).get(String(kardex.id)) ?? null;

    const planes = await this.dataSource.manager
      .createQueryBuilder(KardexInteres, 'plan')
      .leftJoinAndSelect('plan.cuotas', 'cuota')
      .leftJoinAndSelect('plan.eventos', 'evento')
      // Quién y cuándo: la auditoría no viene en un select normal.
      .addSelect([
        'plan.usuarioRegistro',
        'plan.fechaRegistro',
        'evento.usuarioRegistro',
        'evento.fechaRegistro',
      ])
      .where('plan.idKardex = :idKardex', { idKardex: kardex.id })
      .andWhere('plan.activo = true')
      .orderBy('plan.id', 'DESC')
      .addOrderBy('cuota.numero', 'ASC')
      .addOrderBy('evento.id', 'DESC')
      .getMany();

    return {
      kardex: {
        id: kardex.id,
        codigo: kardex.codigo,
        tipo: kardex.tipo,
        estado: kardex.estado,
        saldoActual: kardex.saldoActual,
      },
      resumen,
      vigente: planes.find((p) => p.estado === 'VIGENTE') ?? null,
      planes,
    };
  }

  /**
   * Un kardex no se cierra con intereses sin resolver: el saldo que arrastra
   * el siguiente no los incluiría y las cuotas quedarían colgadas del cerrado.
   */
  async validarCierre(kardex: Kardex): Promise<void> {
    const resumen = (await this.resumenes([kardex])).get(String(kardex.id));
    if (!resumen) {
      return;
    }
    if (resumen.cuotasPendientes > 0) {
      throw new BadRequestException(
        `El kardex ${kardex.codigo} tiene ${resumen.cuotasPendientes} cuota(s) de interés pendientes (Bs ${resumen.pendiente.toFixed(2)}). ` +
          'Cargalas al kardex o condonalas antes de cerrarlo.',
      );
    }
    if (resumen.idKardexInteres) {
      throw new BadRequestException(
        `El kardex ${kardex.codigo} tiene un plan de intereses vigente. Finalizalo antes de cerrarlo; en el kardex nuevo se puede aplicar otro.`,
      );
    }
  }

  // ------------------------------------------------------------------ operaciones
  async aplicar(
    idKardex: string,
    dto: AplicarKardexInteresDto,
    user: Usuario,
  ): Promise<DetalleInteresKardex> {
    const kardex = await this.dataSource.manager.findOne(Kardex, {
      where: { id: idKardex },
    });
    if (!kardex) {
      throw new NotFoundException('No se encontró el kardex.');
    }
    if (kardex.tipo === 'CLIENTE') {
      throw new BadRequestException(
        'Los intereses solo se aplican a kardex de actores, asociados y personal.',
      );
    }
    if (kardex.estado !== 'ABIERTO' || kardex.activo === false) {
      throw new BadRequestException(
        `El kardex ${kardex.codigo} no está abierto: el interés se aplica sobre el kardex vigente.`,
      );
    }
    if (Number(kardex.saldoActual) <= 0) {
      throw new BadRequestException(
        `El kardex ${kardex.codigo} no tiene deuda (saldo Bs ${Number(kardex.saldoActual).toFixed(2)}).`,
      );
    }

    await this.dataSource.transaction(async (manager) => {
      const vigente = await manager.findOne(KardexInteres, {
        where: { idKardex: kardex.id, estado: 'VIGENTE', activo: true },
      });
      if (vigente) {
        throw new ConflictException(
          `El kardex ${kardex.codigo} ya tiene un interés vigente del ${this.tasaTexto(vigente.tasaMensual)} % mensual. Cambiale la tasa o finalizalo.`,
        );
      }
      const plan = await manager.save(
        manager.create(KardexInteres, {
          idKardex: kardex.id,
          tasaMensual: dto.tasaMensual,
          fechaInicio: dto.fechaInicio?.slice(0, 10) ?? this.hoy(),
          estado: 'VIGENTE',
          observaciones: this.normalizar(dto.observaciones),
          usuarioRegistro: user.usuario,
        }),
      );
      await this.registrarEvento(manager, plan, 'APLICACION', user, {
        tasaNueva: dto.tasaMensual,
        observacion: dto.observaciones,
      });
      // Con fecha de inicio pasada, los meses ya cumplidos nacen ahora.
      await this.sincronizar(manager, plan, user.usuario);
    });

    return this.detalle(kardex.id);
  }

  /** Acuerdo de nueva tasa: recalcula todas las cuotas pendientes. */
  async cambiarTasa(
    idPlan: string,
    dto: CambiarTasaKardexInteresDto,
    user: Usuario,
  ): Promise<DetalleInteresKardex> {
    const idKardex = await this.dataSource.transaction(async (manager) => {
      const plan = await this.obtenerPlan(manager, idPlan);
      const tasaAnterior = Number(plan.tasaMensual);
      if (tasaAnterior === Number(dto.tasaMensual)) {
        throw new BadRequestException(
          `El plan ya tiene una tasa del ${this.tasaTexto(tasaAnterior)} % mensual.`,
        );
      }
      await this.sincronizar(manager, plan, user.usuario);
      const antes = await this.cuotasPendientes(manager, plan);
      if (plan.estado !== 'VIGENTE' && antes.length === 0) {
        throw new BadRequestException(
          'El plan está finalizado y no tiene cuotas pendientes: no hay nada que recalcular.',
        );
      }

      plan.tasaMensual = dto.tasaMensual;
      await manager.update(KardexInteres, plan.id, {
        tasaMensual: dto.tasaMensual,
        usuarioUltimaModificacion: user.usuario,
      });
      await this.sincronizar(manager, plan, user.usuario);
      const despues = await this.cuotasPendientes(manager, plan);

      await this.registrarEvento(manager, plan, 'CAMBIO_TASA', user, {
        tasaAnterior,
        tasaNueva: dto.tasaMensual,
        montoAnterior: this.total(antes),
        monto: this.total(despues),
        cuotas: despues.length,
        observacion: dto.observacion,
      });
      return plan.idKardex;
    });
    return this.detalle(idKardex);
  }

  /** Perdona las cuotas pendientes: no se cobran ni pasan al kardex. */
  async condonar(
    idPlan: string,
    dto: CondonarKardexInteresDto,
    user: Usuario,
  ): Promise<DetalleInteresKardex> {
    const idKardex = await this.dataSource.transaction(async (manager) => {
      const plan = await this.obtenerPlan(manager, idPlan);
      await this.sincronizar(manager, plan, user.usuario);
      const pendientes = await this.cuotasPendientes(manager, plan);
      if (pendientes.length === 0) {
        throw new BadRequestException(
          plan.estado === 'VIGENTE'
            ? 'Todavía no hay intereses pendientes para condonar. Para que deje de generar intereses, finalizá el plan.'
            : 'No hay intereses pendientes para condonar.',
        );
      }

      await manager.update(
        KardexInteresCuota,
        { id: In(pendientes.map((c) => c.id)) },
        { estado: 'CONDONADO', usuarioUltimaModificacion: user.usuario },
      );
      if (dto.finalizar !== false && plan.estado === 'VIGENTE') {
        await manager.update(KardexInteres, plan.id, {
          estado: 'FINALIZADO',
          fechaFin: this.hoy(),
          usuarioUltimaModificacion: user.usuario,
        });
      }
      await this.registrarEvento(manager, plan, 'CONDONACION', user, {
        monto: this.total(pendientes),
        cuotas: pendientes.length,
        observacion: dto.observacion,
      });
      return plan.idKardex;
    });
    return this.detalle(idKardex);
  }

  /**
   * Carga las cuotas pendientes al kardex como UNA línea DEBE sin movimiento
   * de dinero (no sale plata de caja ni de banco: es deuda nueva). Desde ahí
   * se cobra con un recibo como el resto de la deuda.
   */
  async cargar(
    idPlan: string,
    dto: CargarKardexInteresDto,
    user: Usuario,
  ): Promise<DetalleInteresKardex> {
    const previo = await this.obtenerPlan(this.dataSource.manager, idPlan);
    const kardex = previo.kardex;
    if (!kardex || kardex.estado !== 'ABIERTO' || kardex.activo === false) {
      throw new BadRequestException(
        'El kardex de este plan no está abierto: no se le puede cargar el interés.',
      );
    }
    await this.kardexActividadService.validarActivo(kardex);

    await this.dataSource.transaction(async (manager) => {
      const plan = await this.obtenerPlan(manager, idPlan);
      await this.sincronizar(manager, plan, user.usuario);
      const pendientes = await this.cuotasPendientes(manager, plan);
      const total = this.total(pendientes);
      if (total <= 0) {
        throw new BadRequestException('No hay intereses pendientes para cargar al kardex.');
      }

      const meses = pendientes.length;
      const linea = await this.movimientoKardexService.crearLineaSinMovimientoDineroEnTransaccion(
        manager,
        kardex,
        {
          fecha: dto.fecha?.slice(0, 10) ?? this.hoy(),
          detalle:
            `INTERESES POR MORA ${this.tasaTexto(plan.tasaMensual)} % MENSUAL - ` +
            `${meses} ${meses === 1 ? 'MES' : 'MESES'} ` +
            `(DEL ${this.texto(this.iso(pendientes[0].fechaDesde))} AL ${this.texto(this.iso(pendientes[meses - 1].fechaCorte))})`,
          facturaRecibo: `INT-${plan.id}`,
          debe: total,
          haber: 0,
          usuarioRegistro: user.usuario,
        },
      );

      await manager.update(
        KardexInteresCuota,
        { id: In(pendientes.map((c) => c.id)) },
        {
          estado: 'CARGADO',
          idMovimientoKardex: linea.id,
          usuarioUltimaModificacion: user.usuario,
        },
      );
      if (dto.finalizar === true && plan.estado === 'VIGENTE') {
        await manager.update(KardexInteres, plan.id, {
          estado: 'FINALIZADO',
          fechaFin: this.hoy(),
          usuarioUltimaModificacion: user.usuario,
        });
      }
      await this.registrarEvento(manager, plan, 'CARGO_KARDEX', user, {
        monto: total,
        cuotas: meses,
        observacion: dto.observacion,
        idMovimientoKardex: linea.id,
      });
    });

    return this.detalle(kardex.id);
  }

  /**
   * Deshace un cargo: da de baja su línea del kardex y las cuotas vuelven a
   * PENDIENTE (se pueden volver a negociar, cargar o condonar).
   */
  async revertirCargo(
    idMovimientoKardex: string,
    dto: ObservacionKardexInteresDto,
    user: Usuario,
  ): Promise<DetalleInteresKardex> {
    const idKardex = await this.dataSource.transaction(async (manager) => {
      const cuotas = await manager.find(KardexInteresCuota, {
        where: { idMovimientoKardex, estado: 'CARGADO' },
      });
      if (cuotas.length === 0) {
        throw new NotFoundException('Esa línea del kardex no es un cargo de intereses.');
      }
      const plan = await this.obtenerPlan(manager, cuotas[0].idKardexInteres);
      if (plan.kardex?.estado !== 'ABIERTO') {
        throw new BadRequestException(
          `El kardex ${plan.kardex?.codigo ?? ''} está cerrado: el cargo ya forma parte de su saldo de cierre.`,
        );
      }

      await manager.update(
        KardexInteresCuota,
        { id: In(cuotas.map((c) => c.id)) },
        {
          estado: 'PENDIENTE',
          idMovimientoKardex: null,
          usuarioUltimaModificacion: user.usuario,
        },
      );
      await this.movimientoKardexService.desactivarLineaSinMovimientoDineroEnTransaccion(
        manager,
        idMovimientoKardex,
        user.usuario,
      );
      await this.registrarEvento(manager, plan, 'REVERSION_CARGO', user, {
        monto: this.total(cuotas),
        cuotas: cuotas.length,
        observacion: dto.observacion,
        idMovimientoKardex,
      });
      // Sin la línea, el saldo base de esos meses puede haber cambiado.
      await this.sincronizar(manager, plan, user.usuario);
      return plan.idKardex;
    });
    return this.detalle(idKardex);
  }

  /** Deja de generar cuotas. Las pendientes siguen ahí para cargar o condonar. */
  async finalizar(
    idPlan: string,
    dto: ObservacionKardexInteresDto,
    user: Usuario,
  ): Promise<DetalleInteresKardex> {
    const idKardex = await this.dataSource.transaction(async (manager) => {
      const plan = await this.obtenerPlan(manager, idPlan);
      if (plan.estado !== 'VIGENTE') {
        throw new BadRequestException('El plan de intereses ya está finalizado.');
      }
      await this.sincronizar(manager, plan, user.usuario);
      await manager.update(KardexInteres, plan.id, {
        estado: 'FINALIZADO',
        fechaFin: this.hoy(),
        usuarioUltimaModificacion: user.usuario,
      });
      await this.registrarEvento(manager, plan, 'FINALIZACION', user, {
        observacion: dto.observacion,
      });
      return plan.idKardex;
    });
    return this.detalle(idKardex);
  }
}
