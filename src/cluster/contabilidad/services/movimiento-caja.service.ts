import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';

import { Usuario } from 'src/security/entities/usuario.entity';
import { Caja } from 'src/cluster/parametricas/entities/caja.entity';
import { PersonaCi } from 'src/cluster/comercio-interno/entities/persona-ci.entity';
import { FormaPago } from 'src/cluster/parametricas/entities/forma-pago.entity';
import { DestinoGasto } from 'src/cluster/parametricas/entities/destino-gasto.entity';
import { MovimientoCaja } from '../entities/movimiento-caja.entity';
import { PeriodoCaja, MonedaCaja } from '../entities/periodo-caja.entity';
import { CreateMovimientoCajaDto } from '../dto/movimiento-caja/create-movimiento-caja.dto';
import { FiltroMovimientoCajaDto } from '../dto/movimiento-caja/filtro-movimiento-caja.dto';
import { CerrarPeriodoCajaDto } from '../dto/movimiento-caja/cerrar-periodo-caja.dto';
import { CerrarGestionCajaDto } from '../dto/movimiento-caja/cerrar-gestion-caja.dto';

@Injectable()
export class MovimientoCajaService {
  constructor(
    @InjectRepository(MovimientoCaja, 'ci')
    private readonly movimientoRepository: Repository<MovimientoCaja>,

    @InjectRepository(PeriodoCaja, 'ci')
    private readonly periodoRepository: Repository<PeriodoCaja>,

    @InjectRepository(Caja, 'ci')
    private readonly cajaRepository: Repository<Caja>,

    @InjectRepository(PersonaCi, 'ci')
    private readonly personaRepository: Repository<PersonaCi>,

    @InjectRepository(FormaPago, 'ci')
    private readonly formaPagoRepository: Repository<FormaPago>,

    @InjectRepository(DestinoGasto, 'ci')
    private readonly destinoGastoRepository: Repository<DestinoGasto>,

    @InjectDataSource('ci')
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Resuelve el beneficiario del movimiento:
   *   - con `idPersona`: valida que exista en persona_ci y usa su nombre
   *     (o el texto manual si vino);
   *   - sin `idPersona`: guarda solo el texto libre `nombresApellidos`.
   */
  private async resolverBeneficiario(
    dto: CreateMovimientoCajaDto,
  ): Promise<{ idPersona: string | null; nombresApellidos: string | null }> {
    const textoManual = dto.nombresApellidos?.trim() || null;

    if (!dto.idPersona) {
      return { idPersona: null, nombresApellidos: textoManual };
    }

    const persona = await this.personaRepository.findOne({
      where: { id: String(dto.idPersona) },
    });
    if (!persona) {
      throw new NotFoundException('La persona seleccionada no existe.');
    }

    const nombreDerivado = [
      persona.nombres,
      persona.apellidoPaterno,
      persona.apellidoMaterno,
    ]
      .filter(Boolean)
      .join(' ')
      .trim()
      .toUpperCase();

    return {
      idPersona: persona.id,
      nombresApellidos: textoManual || nombreDerivado || null,
    };
  }

  private async resolverFormaPago(
    idFormaPago?: number,
  ): Promise<number | null> {
    if (!idFormaPago) {
      return null;
    }
    const formaPago = await this.formaPagoRepository.findOne({
      where: { id: idFormaPago },
    });
    if (!formaPago) {
      throw new NotFoundException('La forma de pago indicada no existe.');
    }
    return formaPago.id;
  }

  private async resolverDestinoGasto(
    idDestinoGasto?: number,
  ): Promise<number | null> {
    if (!idDestinoGasto) {
      return null;
    }
    const destinoGasto = await this.destinoGastoRepository.findOne({
      where: { id: idDestinoGasto },
    });
    if (!destinoGasto) {
      throw new NotFoundException('El destino del gasto indicado no existe.');
    }
    return destinoGasto.id;
  }

  // ------------------------------------------------------------------ helpers
  private r2(n: number): number {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  /** Fecha de hoy en hora de Bolivia (UTC-4 fijo). */
  private hoy(): string {
    return new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString().slice(0, 10);
  }

  private pad(n: number): string {
    return String(n).padStart(2, '0');
  }

  private gestionMesDeFecha(fecha: string): [number, number] {
    return [Number(fecha.slice(0, 4)), Number(fecha.slice(5, 7))];
  }

  private ingresoEgreso(dto: CreateMovimientoCajaDto): {
    ingreso: number;
    egreso: number;
  } {
    const monto = this.r2(Number(dto.monto));
    return dto.tipo === 'INGRESO'
      ? { ingreso: monto, egreso: 0 }
      : { ingreso: 0, egreso: monto };
  }

  private async obtenerCajaActiva(id: number): Promise<Caja> {
    const caja = await this.cajaRepository.findOne({ where: { id } });
    if (!caja) {
      throw new NotFoundException('No se encontró la caja.');
    }
    if (!caja.activo) {
      throw new BadRequestException('La caja está inactiva.');
    }
    return caja;
  }

  /**
   * Además de estar activa, exige que la caja ya haya sido "aperturada" en
   * esa moneda (saldo inicial + fecha de apertura cargados vía
   * POST /parametricas/caja). Sin apertura no se puede empezar a poblar
   * movimientos: no habría desde qué saldo arrastrar.
   */
  async obtenerCajaAperturada(id: number, moneda: MonedaCaja): Promise<Caja> {
    const caja = await this.obtenerCajaActiva(id);
    const fechaApertura =
      moneda === 'BOB' ? caja.fechaSaldoInicialBob : caja.fechaSaldoInicialUsd;
    if (!fechaApertura) {
      throw new BadRequestException(
        `La caja "${caja.nombre}" todavía no fue aperturada en ${moneda}. Cargá el monto y la fecha de apertura (POST /parametricas/caja) antes de registrar movimientos.`,
      );
    }
    return caja;
  }

  private saldoInicialCaja(caja: Caja, moneda: MonedaCaja): number {
    return this.r2(
      Number(moneda === 'BOB' ? caja.saldoInicialBob : caja.saldoInicialUsd),
    );
  }

  /** Folio siguiente para la caja dentro de una gestión, por moneda. */
  private async siguienteFolio(
    manager: EntityManager,
    idCaja: number,
    moneda: MonedaCaja,
    gestion: number,
  ): Promise<number> {
    const row = await manager
      .createQueryBuilder(MovimientoCaja, 'm')
      .innerJoin('m.periodoCaja', 'p')
      .select('COALESCE(MAX(m.folio), 0)', 'max')
      .where('m.idCaja = :c', { c: idCaja })
      .andWhere('m.moneda = :mo', { mo: moneda })
      .andWhere('p.gestion = :g', { g: gestion })
      .getRawOne<{ max: string }>();
    return Number(row?.max ?? 0) + 1;
  }

  private async obtenerOCrearPeriodoMensual(
    manager: EntityManager,
    idCaja: number,
    moneda: MonedaCaja,
    gestion: number,
    mes: number,
    user: Usuario,
  ): Promise<PeriodoCaja> {
    const gestionCerrada = await manager.findOne(PeriodoCaja, {
      where: {
        idCaja,
        moneda,
        tipo: 'GESTION',
        gestion,
        estado: 'CERRADO',
      },
    });
    if (gestionCerrada) {
      throw new BadRequestException(
        `La gestión ${gestion} (${moneda}) de esta caja está cerrada.`,
      );
    }

    const periodo = await manager.findOne(PeriodoCaja, {
      where: { idCaja, moneda, tipo: 'MENSUAL', gestion, mes },
    });
    if (periodo) {
      if (periodo.estado === 'CERRADO') {
        throw new BadRequestException(
          `El período ${this.pad(mes)}/${gestion} (${moneda}) de esta caja está cerrado. Registrá una regularización en el período abierto.`,
        );
      }
      return periodo;
    }

    return await manager.save(
      manager.create(PeriodoCaja, {
        idCaja,
        moneda,
        tipo: 'MENSUAL',
        gestion,
        mes,
        estado: 'ABIERTO',
        saldoInicial: 0,
        totalIngreso: 0,
        totalEgreso: 0,
        saldoFinal: null,
        usuarioRegistro: user.usuario,
      }),
    );
  }

  /**
   * Recalcula la caja para una moneda: recorre los períodos mensuales en
   * orden cronológico arrastrando el saldo. Los períodos CERRADOS quedan
   * congelados (se toma su saldo_final); los ABIERTOS se recalculan.
   */
  private async recalcularCaja(
    manager: EntityManager,
    idCaja: number,
    moneda: MonedaCaja,
  ): Promise<void> {
    const caja = await manager.findOne(Caja, { where: { id: idCaja } });
    const periodos = await manager.find(PeriodoCaja, {
      where: { idCaja, moneda, tipo: 'MENSUAL' },
      order: { gestion: 'ASC', mes: 'ASC' },
    });

    let running = this.saldoInicialCaja(caja, moneda);

    for (const periodo of periodos) {
      if (periodo.estado === 'CERRADO') {
        running = this.r2(Number(periodo.saldoFinal ?? running));
        continue;
      }

      const movs = await manager.find(MovimientoCaja, {
        where: { idPeriodoCaja: periodo.id, activo: true },
        order: { fecha: 'ASC', id: 'ASC' },
      });

      const saldoInicial = running;
      let totalIngreso = 0;
      let totalEgreso = 0;

      for (const mov of movs) {
        running = this.r2(running + Number(mov.ingreso) - Number(mov.egreso));
        totalIngreso = this.r2(totalIngreso + Number(mov.ingreso));
        totalEgreso = this.r2(totalEgreso + Number(mov.egreso));
        if (this.r2(Number(mov.saldo)) !== running) {
          await manager.update(MovimientoCaja, mov.id, { saldo: running });
        }
      }

      await manager.update(PeriodoCaja, periodo.id, {
        saldoInicial,
        totalIngreso,
        totalEgreso,
        saldoFinal: null,
      });
    }
  }

  // ------------------------------------------------------------------ CRUD
  async guardar(
    dto: CreateMovimientoCajaDto,
    user: Usuario,
  ): Promise<MovimientoCaja> {
    return dto.id ? this.actualizar(dto, user) : this.crear(dto, user);
  }

  /**
   * Núcleo de "crear un movimiento" (período + folio + inserción +
   * recálculo), reusable dentro de una transacción ya abierta por otro
   * servicio (ej. ReciboService, que además necesita registrar líneas de
   * kardex en la misma transacción atómica).
   */
  async crearMovimientoEnTransaccion(
    manager: EntityManager,
    caja: Caja,
    datos: {
      moneda: MonedaCaja;
      fecha: string;
      nroComprobante?: string | null;
      idFormaPago?: number | null;
      idPersona?: string | null;
      nombresApellidos?: string | null;
      concepto: string;
      idDestinoGasto?: number | null;
      idRecibo?: string | null;
      ingreso: number;
      egreso: number;
    },
    user: Usuario,
  ): Promise<MovimientoCaja> {
    const [gestion, mes] = this.gestionMesDeFecha(datos.fecha);
    const periodo = await this.obtenerOCrearPeriodoMensual(
      manager,
      caja.id,
      datos.moneda,
      gestion,
      mes,
      user,
    );
    const folio = await this.siguienteFolio(manager, caja.id, datos.moneda, gestion);

    const mov = await manager.save(
      manager.create(MovimientoCaja, {
        idCaja: caja.id,
        idPeriodoCaja: periodo.id,
        moneda: datos.moneda,
        folio,
        fecha: datos.fecha,
        nroComprobante: datos.nroComprobante ?? null,
        idFormaPago: datos.idFormaPago ?? null,
        idPersona: datos.idPersona ?? null,
        nombresApellidos: datos.nombresApellidos ?? null,
        concepto: datos.concepto,
        idDestinoGasto: datos.idDestinoGasto ?? null,
        idRecibo: datos.idRecibo ?? null,
        ingreso: datos.ingreso,
        egreso: datos.egreso,
        saldo: 0,
        usuarioRegistro: user.usuario,
      }),
    );

    await this.recalcularCaja(manager, caja.id, datos.moneda);

    return manager.findOne(MovimientoCaja, {
      where: { id: mov.id },
      relations: { periodoCaja: true, persona: true, formaPago: true, destinoGasto: true },
    });
  }

  private async crear(
    dto: CreateMovimientoCajaDto,
    user: Usuario,
  ): Promise<MovimientoCaja> {
    const caja = await this.obtenerCajaAperturada(dto.idCaja, dto.moneda);
    const { ingreso, egreso } = this.ingresoEgreso(dto);
    const beneficiario = await this.resolverBeneficiario(dto);
    const idFormaPago = await this.resolverFormaPago(dto.idFormaPago);
    const idDestinoGasto = await this.resolverDestinoGasto(dto.idDestinoGasto);

    return this.dataSource.transaction((manager) =>
      this.crearMovimientoEnTransaccion(
        manager,
        caja,
        {
          moneda: dto.moneda,
          fecha: dto.fecha,
          nroComprobante: dto.nroComprobante?.trim() || null,
          idFormaPago,
          idPersona: beneficiario.idPersona,
          nombresApellidos: beneficiario.nombresApellidos,
          concepto: dto.concepto.trim(),
          idDestinoGasto,
          ingreso,
          egreso,
        },
        user,
      ),
    );
  }

  private async actualizar(
    dto: CreateMovimientoCajaDto,
    user: Usuario,
  ): Promise<MovimientoCaja> {
    const mov = await this.movimientoRepository.findOne({
      where: { id: String(dto.id) },
      relations: { periodoCaja: true },
    });
    if (!mov) {
      throw new NotFoundException('No se encontró el movimiento solicitado.');
    }
    if (mov.periodoCaja.estado === 'CERRADO') {
      throw new BadRequestException(
        'El movimiento pertenece a un período cerrado y no puede modificarse. Registrá una regularización en el período abierto.',
      );
    }

    const caja = await this.obtenerCajaActiva(dto.idCaja);
    if (caja.id !== mov.idCaja) {
      throw new BadRequestException('No se puede cambiar el movimiento de caja.');
    }
    if (dto.moneda !== mov.moneda) {
      throw new BadRequestException('No se puede cambiar la moneda del movimiento.');
    }

    const [gestion, mes] = this.gestionMesDeFecha(dto.fecha);
    const { ingreso, egreso } = this.ingresoEgreso(dto);
    const beneficiario = await this.resolverBeneficiario(dto);
    const idFormaPago = await this.resolverFormaPago(dto.idFormaPago);
    const idDestinoGasto = await this.resolverDestinoGasto(dto.idDestinoGasto);

    return this.dataSource.transaction(async (manager) => {
      let idPeriodoCaja = mov.idPeriodoCaja;
      let folio = mov.folio;

      if (mov.periodoCaja.gestion !== gestion || mov.periodoCaja.mes !== mes) {
        const destino = await this.obtenerOCrearPeriodoMensual(
          manager,
          caja.id,
          dto.moneda,
          gestion,
          mes,
          user,
        );
        idPeriodoCaja = destino.id;
        if (mov.periodoCaja.gestion !== gestion) {
          folio = await this.siguienteFolio(manager, caja.id, dto.moneda, gestion);
        }
      }

      await manager.update(MovimientoCaja, mov.id, {
        idPeriodoCaja,
        folio,
        fecha: dto.fecha,
        nroComprobante: dto.nroComprobante?.trim() || null,
        idFormaPago,
        idPersona: beneficiario.idPersona,
        nombresApellidos: beneficiario.nombresApellidos,
        concepto: dto.concepto.trim(),
        idDestinoGasto,
        ingreso,
        egreso,
        usuarioUltimaModificacion: user.usuario,
      });

      await this.recalcularCaja(manager, caja.id, dto.moneda);

      return manager.findOne(MovimientoCaja, {
        where: { id: mov.id },
        relations: { periodoCaja: true, persona: true, formaPago: true, destinoGasto: true },
      });
    });
  }

  async cambiarEstado(
    id: number,
    activo: boolean,
    user: Usuario,
  ): Promise<MovimientoCaja> {
    const mov = await this.movimientoRepository.findOne({
      where: { id: String(id) },
      relations: { periodoCaja: true },
    });
    if (!mov) {
      throw new NotFoundException('No se encontró el movimiento solicitado.');
    }
    if (mov.periodoCaja.estado === 'CERRADO') {
      throw new BadRequestException(
        'El movimiento pertenece a un período cerrado y no puede modificarse.',
      );
    }

    return this.dataSource.transaction(async (manager) => {
      await manager.update(MovimientoCaja, mov.id, {
        activo,
        usuarioUltimaModificacion: user.usuario,
      });
      await this.recalcularCaja(manager, mov.idCaja, mov.moneda);
      return manager.findOne(MovimientoCaja, {
        where: { id: mov.id },
        relations: { periodoCaja: true, persona: true, formaPago: true, destinoGasto: true },
      });
    });
  }

  async listar(filtro: FiltroMovimientoCajaDto) {
    const caja = await this.obtenerCajaActiva(filtro.idCaja);

    const qb = this.movimientoRepository
      .createQueryBuilder('m')
      .innerJoinAndSelect('m.periodoCaja', 'p')
      .leftJoinAndSelect('m.persona', 'per')
      .leftJoinAndSelect('m.formaPago', 'fp')
      .leftJoinAndSelect('m.destinoGasto', 'dg')
      .where('m.idCaja = :id', { id: caja.id })
      .andWhere('m.moneda = :moneda', { moneda: filtro.moneda });

    if (filtro.gestion) {
      qb.andWhere('p.gestion = :g', { g: filtro.gestion });
    }
    if (filtro.mes) {
      qb.andWhere('p.mes = :m', { m: filtro.mes });
    }

    qb.orderBy('m.fecha', 'ASC').addOrderBy('m.id', 'ASC');
    const movimientos = await qb.getMany();

    const wherePeriodo: Record<string, unknown> = {
      idCaja: caja.id,
      moneda: filtro.moneda,
    };
    if (filtro.gestion) {
      wherePeriodo.gestion = filtro.gestion;
    }
    if (filtro.mes) {
      wherePeriodo.tipo = 'MENSUAL';
      wherePeriodo.mes = filtro.mes;
    }
    const periodos = await this.periodoRepository.find({
      where: wherePeriodo,
      order: { gestion: 'DESC', tipo: 'ASC', mes: 'ASC' },
    });

    return {
      caja: {
        id: caja.id,
        nombre: caja.nombre,
        moneda: filtro.moneda,
        saldoInicial: this.saldoInicialCaja(caja, filtro.moneda),
        fechaSaldoInicial:
          filtro.moneda === 'BOB'
            ? (caja.fechaSaldoInicialBob ?? null)
            : (caja.fechaSaldoInicialUsd ?? null),
      },
      periodos,
      movimientos,
    };
  }

  async listarPeriodos(
    idCaja: number,
    moneda: MonedaCaja,
  ): Promise<PeriodoCaja[]> {
    const caja = await this.obtenerCajaActiva(idCaja);
    return this.periodoRepository.find({
      where: { idCaja: caja.id, moneda },
      order: { gestion: 'DESC', tipo: 'ASC', mes: 'ASC' },
    });
  }

  // ------------------------------------------------------------------ cierres
  async cerrarPeriodo(
    dto: CerrarPeriodoCajaDto,
    user: Usuario,
  ): Promise<PeriodoCaja> {
    const caja = await this.obtenerCajaActiva(dto.idCaja);
    const clave = dto.gestion * 100 + dto.mes;

    return this.dataSource.transaction(async (manager) => {
      const periodo = await manager.findOne(PeriodoCaja, {
        where: {
          idCaja: caja.id,
          moneda: dto.moneda,
          tipo: 'MENSUAL',
          gestion: dto.gestion,
          mes: dto.mes,
        },
      });
      if (!periodo) {
        throw new NotFoundException(
          `No hay movimientos registrados en ${this.pad(dto.mes)}/${dto.gestion} (${dto.moneda}) para esta caja.`,
        );
      }
      if (periodo.estado === 'CERRADO') {
        throw new BadRequestException(
          `El período ${this.pad(dto.mes)}/${dto.gestion} (${dto.moneda}) ya está cerrado.`,
        );
      }

      const anterior = await manager
        .createQueryBuilder(PeriodoCaja, 'p')
        .where('p.idCaja = :id', { id: caja.id })
        .andWhere('p.moneda = :mo', { mo: dto.moneda })
        .andWhere("p.tipo = 'MENSUAL'")
        .andWhere('(p.gestion * 100 + p.mes) < :clave', { clave })
        .orderBy('(p.gestion * 100 + p.mes)', 'DESC')
        .getOne();
      if (anterior && anterior.estado !== 'CERRADO') {
        throw new BadRequestException(
          `Primero cerrá el período ${this.pad(anterior.mes)}/${anterior.gestion} (${dto.moneda}).`,
        );
      }

      await this.recalcularCaja(manager, caja.id, dto.moneda);

      const fresco = await manager.findOne(PeriodoCaja, {
        where: { id: periodo.id },
      });
      const saldoFinal = this.r2(
        Number(fresco.saldoInicial) +
          Number(fresco.totalIngreso) -
          Number(fresco.totalEgreso),
      );

      await manager.update(PeriodoCaja, periodo.id, {
        estado: 'CERRADO',
        saldoFinal,
        fechaCierre: this.hoy(),
        cerradoPor: user.usuario,
        usuarioUltimaModificacion: user.usuario,
      });

      await this.recalcularCaja(manager, caja.id, dto.moneda);

      return manager.findOne(PeriodoCaja, { where: { id: periodo.id } });
    });
  }

  async reabrirPeriodo(
    dto: CerrarPeriodoCajaDto,
    user: Usuario,
  ): Promise<PeriodoCaja> {
    const caja = await this.obtenerCajaActiva(dto.idCaja);
    const clave = dto.gestion * 100 + dto.mes;

    return this.dataSource.transaction(async (manager) => {
      const periodo = await manager.findOne(PeriodoCaja, {
        where: {
          idCaja: caja.id,
          moneda: dto.moneda,
          tipo: 'MENSUAL',
          gestion: dto.gestion,
          mes: dto.mes,
        },
      });
      if (!periodo) {
        throw new NotFoundException(
          `No existe el período ${this.pad(dto.mes)}/${dto.gestion} (${dto.moneda}) para esta caja.`,
        );
      }
      if (periodo.estado !== 'CERRADO') {
        throw new BadRequestException('El período no está cerrado.');
      }

      const gestionCerrada = await manager.findOne(PeriodoCaja, {
        where: {
          idCaja: caja.id,
          moneda: dto.moneda,
          tipo: 'GESTION',
          gestion: dto.gestion,
          estado: 'CERRADO',
        },
      });
      if (gestionCerrada) {
        throw new BadRequestException(
          `Primero reabrí la gestión ${dto.gestion} (${dto.moneda}).`,
        );
      }

      const siguiente = await manager
        .createQueryBuilder(PeriodoCaja, 'p')
        .where('p.idCaja = :id', { id: caja.id })
        .andWhere('p.moneda = :mo', { mo: dto.moneda })
        .andWhere("p.tipo = 'MENSUAL'")
        .andWhere('(p.gestion * 100 + p.mes) > :clave', { clave })
        .orderBy('(p.gestion * 100 + p.mes)', 'ASC')
        .getOne();
      if (siguiente && siguiente.estado === 'CERRADO') {
        throw new BadRequestException(
          `Primero reabrí el período ${this.pad(siguiente.mes)}/${siguiente.gestion} (${dto.moneda}).`,
        );
      }

      await manager.update(PeriodoCaja, periodo.id, {
        estado: 'ABIERTO',
        saldoFinal: null,
        fechaCierre: null,
        cerradoPor: null,
        usuarioUltimaModificacion: user.usuario,
      });

      await this.recalcularCaja(manager, caja.id, dto.moneda);

      return manager.findOne(PeriodoCaja, { where: { id: periodo.id } });
    });
  }

  async cerrarGestion(
    dto: CerrarGestionCajaDto,
    user: Usuario,
  ): Promise<PeriodoCaja> {
    const caja = await this.obtenerCajaActiva(dto.idCaja);

    return this.dataSource.transaction(async (manager) => {
      const meses = await manager.find(PeriodoCaja, {
        where: {
          idCaja: caja.id,
          moneda: dto.moneda,
          tipo: 'MENSUAL',
          gestion: dto.gestion,
        },
        order: { mes: 'ASC' },
      });

      const faltantes: string[] = [];
      for (let m = 1; m <= 12; m++) {
        const p = meses.find((x) => x.mes === m);
        if (!p) {
          faltantes.push(`${this.pad(m)} (sin registrar)`);
        } else if (p.estado !== 'CERRADO') {
          faltantes.push(`${this.pad(m)} (abierto)`);
        }
      }
      if (faltantes.length > 0) {
        throw new BadRequestException(
          `No se puede cerrar la gestión ${dto.gestion} (${dto.moneda}). Meses pendientes: ${faltantes.join(', ')}.`,
        );
      }

      const enero = meses.find((x) => x.mes === 1);
      const diciembre = meses.find((x) => x.mes === 12);
      const totalIngreso = this.r2(
        meses.reduce((s, x) => s + Number(x.totalIngreso), 0),
      );
      const totalEgreso = this.r2(
        meses.reduce((s, x) => s + Number(x.totalEgreso), 0),
      );

      const datos = {
        idCaja: caja.id,
        moneda: dto.moneda,
        tipo: 'GESTION' as const,
        gestion: dto.gestion,
        mes: null,
        estado: 'CERRADO' as const,
        saldoInicial: Number(enero.saldoInicial),
        totalIngreso,
        totalEgreso,
        saldoFinal: Number(diciembre.saldoFinal),
        fechaCierre: this.hoy(),
        cerradoPor: user.usuario,
      };

      const existente = await manager.findOne(PeriodoCaja, {
        where: {
          idCaja: caja.id,
          moneda: dto.moneda,
          tipo: 'GESTION',
          gestion: dto.gestion,
        },
      });

      let id: string;
      if (existente) {
        await manager.update(PeriodoCaja, existente.id, {
          ...datos,
          usuarioUltimaModificacion: user.usuario,
        });
        id = existente.id;
      } else {
        const creado = await manager.save(
          manager.create(PeriodoCaja, {
            ...datos,
            usuarioRegistro: user.usuario,
          }),
        );
        id = creado.id;
      }

      return manager.findOne(PeriodoCaja, { where: { id } });
    });
  }

  async reabrirGestion(
    dto: CerrarGestionCajaDto,
    user: Usuario,
  ): Promise<PeriodoCaja> {
    const caja = await this.obtenerCajaActiva(dto.idCaja);
    const gestionPeriodo = await this.periodoRepository.findOne({
      where: {
        idCaja: caja.id,
        moneda: dto.moneda,
        tipo: 'GESTION',
        gestion: dto.gestion,
      },
    });
    if (!gestionPeriodo) {
      throw new NotFoundException(
        `No existe un cierre de la gestión ${dto.gestion} (${dto.moneda}) para esta caja.`,
      );
    }
    if (gestionPeriodo.estado !== 'CERRADO') {
      throw new BadRequestException('La gestión no está cerrada.');
    }

    gestionPeriodo.estado = 'ABIERTO';
    gestionPeriodo.saldoFinal = null;
    gestionPeriodo.fechaCierre = null;
    gestionPeriodo.cerradoPor = null;
    gestionPeriodo.usuarioUltimaModificacion = user.usuario;

    return this.periodoRepository.save(gestionPeriodo);
  }
}
