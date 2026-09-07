import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';

import { Usuario } from 'src/security/entities/usuario.entity';
import { CuentaBancaria } from 'src/cluster/parametricas/entities/cuenta-bancaria.entity';
import { PersonaCi } from 'src/cluster/comercio-interno/entities/persona-ci.entity';
import { LibretaBanco } from '../entities/libreta-banco.entity';
import { PeriodoBanco } from '../entities/periodo-banco.entity';
import { CreateLibretaBancoDto } from '../dto/libreta-banco/create-libreta-banco.dto';
import { FiltroLibretaBancoDto } from '../dto/libreta-banco/filtro-libreta-banco.dto';
import { CerrarPeriodoBancoDto } from '../dto/libreta-banco/cerrar-periodo-banco.dto';
import { CerrarGestionBancoDto } from '../dto/libreta-banco/cerrar-gestion-banco.dto';

@Injectable()
export class LibretaBancoService {
  constructor(
    @InjectRepository(LibretaBanco, 'ci')
    private readonly libretaRepository: Repository<LibretaBanco>,

    @InjectRepository(PeriodoBanco, 'ci')
    private readonly periodoRepository: Repository<PeriodoBanco>,

    @InjectRepository(CuentaBancaria, 'ci')
    private readonly cuentaRepository: Repository<CuentaBancaria>,

    @InjectRepository(PersonaCi, 'ci')
    private readonly personaRepository: Repository<PersonaCi>,

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
    dto: CreateLibretaBancoDto,
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

  private debeHaber(dto: CreateLibretaBancoDto): { debe: number; haber: number } {
    const monto = this.r2(Number(dto.monto));
    return dto.tipo === 'DEBE'
      ? { debe: monto, haber: 0 }
      : { debe: 0, haber: monto };
  }

  private async obtenerCuentaActiva(id: number): Promise<CuentaBancaria> {
    const cuenta = await this.cuentaRepository.findOne({ where: { id } });
    if (!cuenta) {
      throw new NotFoundException('No se encontró la cuenta bancaria.');
    }
    if (!cuenta.activo) {
      throw new BadRequestException('La cuenta bancaria está inactiva.');
    }
    return cuenta;
  }

  /** Folio siguiente para la libreta de una cuenta dentro de una gestión. */
  private async siguienteFolio(
    manager: EntityManager,
    idCuentaBancaria: number,
    gestion: number,
  ): Promise<number> {
    const row = await manager
      .createQueryBuilder(LibretaBanco, 'l')
      .innerJoin('l.periodoBanco', 'p')
      .select('COALESCE(MAX(l.folio), 0)', 'max')
      .where('l.idCuentaBancaria = :c', { c: idCuentaBancaria })
      .andWhere('p.gestion = :g', { g: gestion })
      .getRawOne<{ max: string }>();
    return Number(row?.max ?? 0) + 1;
  }

  private async obtenerOCrearPeriodoMensual(
    manager: EntityManager,
    idCuentaBancaria: number,
    gestion: number,
    mes: number,
    user: Usuario,
  ): Promise<PeriodoBanco> {
    const gestionCerrada = await manager.findOne(PeriodoBanco, {
      where: {
        idCuentaBancaria,
        tipo: 'GESTION',
        gestion,
        estado: 'CERRADO',
      },
    });
    if (gestionCerrada) {
      throw new BadRequestException(
        `La gestión ${gestion} de esta cuenta está cerrada.`,
      );
    }

    const periodo = await manager.findOne(PeriodoBanco, {
      where: { idCuentaBancaria, tipo: 'MENSUAL', gestion, mes },
    });
    if (periodo) {
      if (periodo.estado === 'CERRADO') {
        throw new BadRequestException(
          `El período ${this.pad(mes)}/${gestion} de esta cuenta está cerrado. Registrá una regularización en el período abierto.`,
        );
      }
      return periodo;
    }

    return await manager.save(
      manager.create(PeriodoBanco, {
        idCuentaBancaria,
        tipo: 'MENSUAL',
        gestion,
        mes,
        estado: 'ABIERTO',
        saldoInicial: 0,
        totalDebe: 0,
        totalHaber: 0,
        saldoFinal: null,
        usuarioRegistro: user.usuario,
      }),
    );
  }

  /**
   * Recalcula toda la libreta de una cuenta: recorre los períodos mensuales en
   * orden cronológico arrastrando el saldo. Los períodos CERRADOS quedan
   * congelados (se toma su saldo_final); los ABIERTOS se recalculan.
   */
  private async recalcularCuenta(
    manager: EntityManager,
    idCuentaBancaria: number,
  ): Promise<void> {
    const cuenta = await manager.findOne(CuentaBancaria, {
      where: { id: idCuentaBancaria },
    });
    const periodos = await manager.find(PeriodoBanco, {
      where: { idCuentaBancaria, tipo: 'MENSUAL' },
      order: { gestion: 'ASC', mes: 'ASC' },
    });

    let running = this.r2(Number(cuenta?.saldoInicial ?? 0));

    for (const periodo of periodos) {
      if (periodo.estado === 'CERRADO') {
        running = this.r2(Number(periodo.saldoFinal ?? running));
        continue;
      }

      const movs = await manager.find(LibretaBanco, {
        where: { idPeriodoBanco: periodo.id, activo: true },
        order: { fecha: 'ASC', id: 'ASC' },
      });

      const saldoInicial = running;
      let totalDebe = 0;
      let totalHaber = 0;

      for (const mov of movs) {
        running = this.r2(running - Number(mov.debe) + Number(mov.haber));
        totalDebe = this.r2(totalDebe + Number(mov.debe));
        totalHaber = this.r2(totalHaber + Number(mov.haber));
        if (this.r2(Number(mov.saldo)) !== running) {
          await manager.update(LibretaBanco, mov.id, { saldo: running });
        }
      }

      await manager.update(PeriodoBanco, periodo.id, {
        saldoInicial,
        totalDebe,
        totalHaber,
        saldoFinal: null,
      });
    }
  }

  // ------------------------------------------------------------------ CRUD
  async guardar(
    dto: CreateLibretaBancoDto,
    user: Usuario,
  ): Promise<LibretaBanco> {
    return dto.id ? this.actualizar(dto, user) : this.crear(dto, user);
  }

  private async crear(
    dto: CreateLibretaBancoDto,
    user: Usuario,
  ): Promise<LibretaBanco> {
    const cuenta = await this.obtenerCuentaActiva(dto.idCuentaBancaria);
    const [gestion, mes] = this.gestionMesDeFecha(dto.fecha);
    const { debe, haber } = this.debeHaber(dto);
    const beneficiario = await this.resolverBeneficiario(dto);

    return this.dataSource.transaction(async (manager) => {
      const periodo = await this.obtenerOCrearPeriodoMensual(
        manager,
        cuenta.id,
        gestion,
        mes,
        user,
      );
      const folio = await this.siguienteFolio(manager, cuenta.id, gestion);

      const mov = await manager.save(
        manager.create(LibretaBanco, {
          idCuentaBancaria: cuenta.id,
          idPeriodoBanco: periodo.id,
          folio,
          fecha: dto.fecha,
          nroTransaccion: dto.nroTransaccion?.trim() || null,
          idPersona: beneficiario.idPersona,
          nombresApellidos: beneficiario.nombresApellidos,
          concepto: dto.concepto.trim(),
          debe,
          haber,
          saldo: 0,
          usuarioRegistro: user.usuario,
        }),
      );

      await this.recalcularCuenta(manager, cuenta.id);

      return manager.findOne(LibretaBanco, {
        where: { id: mov.id },
        relations: { periodoBanco: true, persona: true },
      });
    });
  }

  private async actualizar(
    dto: CreateLibretaBancoDto,
    user: Usuario,
  ): Promise<LibretaBanco> {
    const mov = await this.libretaRepository.findOne({
      where: { id: String(dto.id) },
      relations: { periodoBanco: true },
    });
    if (!mov) {
      throw new NotFoundException('No se encontró el movimiento solicitado.');
    }
    if (mov.periodoBanco.estado === 'CERRADO') {
      throw new BadRequestException(
        'El movimiento pertenece a un período cerrado y no puede modificarse. Registrá una regularización en el período abierto.',
      );
    }

    const cuenta = await this.obtenerCuentaActiva(dto.idCuentaBancaria);
    if (cuenta.id !== mov.idCuentaBancaria) {
      throw new BadRequestException(
        'No se puede cambiar el movimiento de cuenta bancaria.',
      );
    }

    const [gestion, mes] = this.gestionMesDeFecha(dto.fecha);
    const { debe, haber } = this.debeHaber(dto);
    const beneficiario = await this.resolverBeneficiario(dto);

    return this.dataSource.transaction(async (manager) => {
      let idPeriodoBanco = mov.idPeriodoBanco;
      let folio = mov.folio;

      if (
        mov.periodoBanco.gestion !== gestion ||
        mov.periodoBanco.mes !== mes
      ) {
        const destino = await this.obtenerOCrearPeriodoMensual(
          manager,
          cuenta.id,
          gestion,
          mes,
          user,
        );
        idPeriodoBanco = destino.id;
        if (mov.periodoBanco.gestion !== gestion) {
          folio = await this.siguienteFolio(manager, cuenta.id, gestion);
        }
      }

      await manager.update(LibretaBanco, mov.id, {
        idPeriodoBanco,
        folio,
        fecha: dto.fecha,
        nroTransaccion: dto.nroTransaccion?.trim() || null,
        idPersona: beneficiario.idPersona,
        nombresApellidos: beneficiario.nombresApellidos,
        concepto: dto.concepto.trim(),
        debe,
        haber,
        usuarioUltimaModificacion: user.usuario,
      });

      await this.recalcularCuenta(manager, cuenta.id);

      return manager.findOne(LibretaBanco, {
        where: { id: mov.id },
        relations: { periodoBanco: true, persona: true },
      });
    });
  }

  async cambiarEstado(
    id: number,
    activo: boolean,
    user: Usuario,
  ): Promise<LibretaBanco> {
    const mov = await this.libretaRepository.findOne({
      where: { id: String(id) },
      relations: { periodoBanco: true },
    });
    if (!mov) {
      throw new NotFoundException('No se encontró el movimiento solicitado.');
    }
    if (mov.periodoBanco.estado === 'CERRADO') {
      throw new BadRequestException(
        'El movimiento pertenece a un período cerrado y no puede modificarse.',
      );
    }

    return this.dataSource.transaction(async (manager) => {
      await manager.update(LibretaBanco, mov.id, {
        activo,
        usuarioUltimaModificacion: user.usuario,
      });
      await this.recalcularCuenta(manager, mov.idCuentaBancaria);
      return manager.findOne(LibretaBanco, {
        where: { id: mov.id },
        relations: { periodoBanco: true, persona: true },
      });
    });
  }

  async listar(filtro: FiltroLibretaBancoDto) {
    const cuenta = await this.obtenerCuentaActiva(filtro.idCuentaBancaria);

    const qb = this.libretaRepository
      .createQueryBuilder('l')
      .innerJoinAndSelect('l.periodoBanco', 'p')
      .leftJoinAndSelect('l.persona', 'per')
      .where('l.idCuentaBancaria = :id', { id: cuenta.id });

    if (filtro.gestion) {
      qb.andWhere('p.gestion = :g', { g: filtro.gestion });
    }
    if (filtro.mes) {
      qb.andWhere('p.mes = :m', { m: filtro.mes });
    }

    qb.orderBy('l.fecha', 'ASC').addOrderBy('l.id', 'ASC');
    const movimientos = await qb.getMany();

    const wherePeriodo: Record<string, unknown> = {
      idCuentaBancaria: cuenta.id,
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
      cuenta: {
        id: cuenta.id,
        numeroCuenta: cuenta.numeroCuenta,
        moneda: cuenta.moneda,
        saldoInicial: cuenta.saldoInicial,
        fechaSaldoInicial: cuenta.fechaSaldoInicial ?? null,
      },
      periodos,
      movimientos,
    };
  }

  async listarPeriodos(idCuentaBancaria: number): Promise<PeriodoBanco[]> {
    const cuenta = await this.obtenerCuentaActiva(idCuentaBancaria);
    return this.periodoRepository.find({
      where: { idCuentaBancaria: cuenta.id },
      order: { gestion: 'DESC', tipo: 'ASC', mes: 'ASC' },
    });
  }

  // ------------------------------------------------------------------ cierres
  async cerrarPeriodo(
    dto: CerrarPeriodoBancoDto,
    user: Usuario,
  ): Promise<PeriodoBanco> {
    const cuenta = await this.obtenerCuentaActiva(dto.idCuentaBancaria);
    const clave = dto.gestion * 100 + dto.mes;

    return this.dataSource.transaction(async (manager) => {
      const periodo = await manager.findOne(PeriodoBanco, {
        where: {
          idCuentaBancaria: cuenta.id,
          tipo: 'MENSUAL',
          gestion: dto.gestion,
          mes: dto.mes,
        },
      });
      if (!periodo) {
        throw new NotFoundException(
          `No hay movimientos registrados en ${this.pad(dto.mes)}/${dto.gestion} para esta cuenta.`,
        );
      }
      if (periodo.estado === 'CERRADO') {
        throw new BadRequestException(
          `El período ${this.pad(dto.mes)}/${dto.gestion} ya está cerrado.`,
        );
      }

      const anterior = await manager
        .createQueryBuilder(PeriodoBanco, 'p')
        .where('p.idCuentaBancaria = :id', { id: cuenta.id })
        .andWhere("p.tipo = 'MENSUAL'")
        .andWhere('(p.gestion * 100 + p.mes) < :clave', { clave })
        .orderBy('(p.gestion * 100 + p.mes)', 'DESC')
        .getOne();
      if (anterior && anterior.estado !== 'CERRADO') {
        throw new BadRequestException(
          `Primero cerrá el período ${this.pad(anterior.mes)}/${anterior.gestion}.`,
        );
      }

      await this.recalcularCuenta(manager, cuenta.id);

      const fresco = await manager.findOne(PeriodoBanco, {
        where: { id: periodo.id },
      });
      const saldoFinal = this.r2(
        Number(fresco.saldoInicial) +
          Number(fresco.totalHaber) -
          Number(fresco.totalDebe),
      );

      await manager.update(PeriodoBanco, periodo.id, {
        estado: 'CERRADO',
        saldoFinal,
        fechaCierre: this.hoy(),
        cerradoPor: user.usuario,
        usuarioUltimaModificacion: user.usuario,
      });

      await this.recalcularCuenta(manager, cuenta.id);

      return manager.findOne(PeriodoBanco, { where: { id: periodo.id } });
    });
  }

  async reabrirPeriodo(
    dto: CerrarPeriodoBancoDto,
    user: Usuario,
  ): Promise<PeriodoBanco> {
    const cuenta = await this.obtenerCuentaActiva(dto.idCuentaBancaria);
    const clave = dto.gestion * 100 + dto.mes;

    return this.dataSource.transaction(async (manager) => {
      const periodo = await manager.findOne(PeriodoBanco, {
        where: {
          idCuentaBancaria: cuenta.id,
          tipo: 'MENSUAL',
          gestion: dto.gestion,
          mes: dto.mes,
        },
      });
      if (!periodo) {
        throw new NotFoundException(
          `No existe el período ${this.pad(dto.mes)}/${dto.gestion} para esta cuenta.`,
        );
      }
      if (periodo.estado !== 'CERRADO') {
        throw new BadRequestException('El período no está cerrado.');
      }

      const gestionCerrada = await manager.findOne(PeriodoBanco, {
        where: {
          idCuentaBancaria: cuenta.id,
          tipo: 'GESTION',
          gestion: dto.gestion,
          estado: 'CERRADO',
        },
      });
      if (gestionCerrada) {
        throw new BadRequestException(
          `Primero reabrí la gestión ${dto.gestion}.`,
        );
      }

      const siguiente = await manager
        .createQueryBuilder(PeriodoBanco, 'p')
        .where('p.idCuentaBancaria = :id', { id: cuenta.id })
        .andWhere("p.tipo = 'MENSUAL'")
        .andWhere('(p.gestion * 100 + p.mes) > :clave', { clave })
        .orderBy('(p.gestion * 100 + p.mes)', 'ASC')
        .getOne();
      if (siguiente && siguiente.estado === 'CERRADO') {
        throw new BadRequestException(
          `Primero reabrí el período ${this.pad(siguiente.mes)}/${siguiente.gestion}.`,
        );
      }

      await manager.update(PeriodoBanco, periodo.id, {
        estado: 'ABIERTO',
        saldoFinal: null,
        fechaCierre: null,
        cerradoPor: null,
        usuarioUltimaModificacion: user.usuario,
      });

      await this.recalcularCuenta(manager, cuenta.id);

      return manager.findOne(PeriodoBanco, { where: { id: periodo.id } });
    });
  }

  async cerrarGestion(
    dto: CerrarGestionBancoDto,
    user: Usuario,
  ): Promise<PeriodoBanco> {
    const cuenta = await this.obtenerCuentaActiva(dto.idCuentaBancaria);

    return this.dataSource.transaction(async (manager) => {
      const meses = await manager.find(PeriodoBanco, {
        where: {
          idCuentaBancaria: cuenta.id,
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
          `No se puede cerrar la gestión ${dto.gestion}. Meses pendientes: ${faltantes.join(', ')}.`,
        );
      }

      const enero = meses.find((x) => x.mes === 1);
      const diciembre = meses.find((x) => x.mes === 12);
      const totalDebe = this.r2(
        meses.reduce((s, x) => s + Number(x.totalDebe), 0),
      );
      const totalHaber = this.r2(
        meses.reduce((s, x) => s + Number(x.totalHaber), 0),
      );

      const datos = {
        idCuentaBancaria: cuenta.id,
        tipo: 'GESTION' as const,
        gestion: dto.gestion,
        mes: null,
        estado: 'CERRADO' as const,
        saldoInicial: Number(enero.saldoInicial),
        totalDebe,
        totalHaber,
        saldoFinal: Number(diciembre.saldoFinal),
        fechaCierre: this.hoy(),
        cerradoPor: user.usuario,
      };

      const existente = await manager.findOne(PeriodoBanco, {
        where: {
          idCuentaBancaria: cuenta.id,
          tipo: 'GESTION',
          gestion: dto.gestion,
        },
      });

      let id: string;
      if (existente) {
        await manager.update(PeriodoBanco, existente.id, {
          ...datos,
          usuarioUltimaModificacion: user.usuario,
        });
        id = existente.id;
      } else {
        const creado = await manager.save(
          manager.create(PeriodoBanco, {
            ...datos,
            usuarioRegistro: user.usuario,
          }),
        );
        id = creado.id;
      }

      return manager.findOne(PeriodoBanco, { where: { id } });
    });
  }

  async reabrirGestion(
    dto: CerrarGestionBancoDto,
    user: Usuario,
  ): Promise<PeriodoBanco> {
    const cuenta = await this.obtenerCuentaActiva(dto.idCuentaBancaria);
    const gestionPeriodo = await this.periodoRepository.findOne({
      where: {
        idCuentaBancaria: cuenta.id,
        tipo: 'GESTION',
        gestion: dto.gestion,
      },
    });
    if (!gestionPeriodo) {
      throw new NotFoundException(
        `No existe un cierre de la gestión ${dto.gestion} para esta cuenta.`,
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
