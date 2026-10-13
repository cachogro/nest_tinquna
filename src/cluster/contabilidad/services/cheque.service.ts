import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';

import { Usuario } from 'src/security/entities/usuario.entity';
import { CuentaBancaria } from 'src/cluster/parametricas/entities/cuenta-bancaria.entity';
import { Cheque, EstadoCheque } from '../entities/cheque.entity';
import { LibretaBanco } from '../entities/libreta-banco.entity';
import { TalonarioCheque } from '../entities/talonario-cheque.entity';
import {
  AnularChequeEnBlancoDto,
  CobrarChequeDto,
  FiltroChequeDto,
  FiltroTalonarioChequeDto,
  GuardarTalonarioChequeDto,
} from '../dto/cheque/cheque.dto';

/**
 * Plazo para presentar un cheque al cobro: 30 días desde su fecha (Código de
 * Comercio, art. 607). El girador puede revalidarlo por el mismo plazo
 * (Reglamento del Cheque del BCB, art. 21).
 */
export const DIAS_COBRO_CHEQUE = 30;
const MAX_CHEQUES_POR_TALONARIO = 1000;
const LIMITE_LISTADO_CHEQUES = 500;

// Umbrales de alerta por defecto; se pueden cambiar en el .env.
const ALERTA_CHEQUES_RESTANTES = 5; // CHEQUES_ALERTA_RESTANTES
const ALERTA_DIAS_POR_VENCER = 5; // CHEQUES_ALERTA_DIAS
// Un talonario con vencimiento se avisa con esta anticipación.
const ALERTA_DIAS_TALONARIO = 30;

export interface ResumenTalonario {
  id: number;
  idCuentaBancaria: number;
  serie: string | null;
  numeroInicial: number;
  numeroFinal: number;
  fechaRecepcion: string;
  fechaVencimiento: string | null;
  observacion: string | null;
  activo: boolean;
  /** Cheques del talonario (numeroFinal − numeroInicial + 1). */
  total: number;
  emitidos: number;
  cobrados: number;
  anulados: number;
  /** Los que todavía no se usaron. */
  disponibles: number;
  /** Próximo número sin usar; null si el talonario se terminó. */
  siguienteNumero: number | null;
}

export interface SiguienteCheque {
  manejaCheques: boolean;
  /** Próximo cheque a usar (del talonario activo más antiguo con saldo). */
  siguienteNumero: number | null;
  serie: string | null;
  idTalonarioCheque: number | null;
  /** Cheques sin usar entre todos los talonarios activos de la cuenta. */
  disponibles: number;
}

export interface ChequeListado extends Cheque {
  idCuentaBancaria: number;
  serie: string | null;
  /** Solo EMITIDO: ya pasó su fecha límite de cobro. */
  vencido: boolean;
  /** Solo EMITIDO: días que faltan para la fecha límite (negativo si venció). */
  diasParaVencer: number | null;
}

export interface CuentaChequesDashboard {
  idCuentaBancaria: number;
  entidadFinanciera: string;
  numeroCuenta: string;
  alias: string | null;
  moneda: string;
  /** Cheques sin usar en los talonarios activos. */
  disponibles: number;
  /** Total de cheques de los talonarios activos. */
  total: number;
  emitidosSinCobrar: number;
  montoSinCobrar: number;
  porVencer: number;
  vencidos: number;
  /** Vencimiento más próximo de un talonario activo con cheques sin usar. */
  talonarioVence: string | null;
}

export interface AlertaCheque {
  nivel: 'alta' | 'media' | 'info';
  titulo: string;
  detalle: string;
  cantidad: number;
}

@Injectable()
export class ChequeService {
  constructor(
    @InjectRepository(TalonarioCheque, 'ci')
    private readonly talonarioRepository: Repository<TalonarioCheque>,

    @InjectRepository(Cheque, 'ci')
    private readonly chequeRepository: Repository<Cheque>,

    @InjectRepository(CuentaBancaria, 'ci')
    private readonly cuentaRepository: Repository<CuentaBancaria>,

    private readonly configService: ConfigService,
  ) {}

  // ------------------------------------------------------------ talonarios
  async guardarTalonario(
    dto: GuardarTalonarioChequeDto,
    user: Usuario,
  ): Promise<ResumenTalonario> {
    const serie = dto.serie?.trim().toUpperCase() || null;
    const observacion = dto.observacion?.trim() || null;
    const fechaVencimiento = dto.fechaVencimiento || null;

    if (dto.numeroFinal < dto.numeroInicial) {
      throw new BadRequestException(
        'El número final no puede ser menor al número inicial.',
      );
    }
    if (dto.numeroFinal - dto.numeroInicial + 1 > MAX_CHEQUES_POR_TALONARIO) {
      throw new BadRequestException(
        `Un talonario no puede tener más de ${MAX_CHEQUES_POR_TALONARIO} cheques. Revisá el rango.`,
      );
    }
    if (fechaVencimiento && fechaVencimiento <= dto.fechaRecepcion) {
      throw new BadRequestException(
        'La fecha de vencimiento debe ser posterior a la fecha de recepción.',
      );
    }

    const cuenta = await this.obtenerCuentaConCheques(dto.idCuentaBancaria);

    let talonario: TalonarioCheque;
    if (dto.id) {
      talonario = await this.obtenerTalonario(dto.id);
      if (talonario.idCuentaBancaria !== cuenta.id) {
        throw new BadRequestException(
          'No se puede cambiar el talonario de cuenta bancaria.',
        );
      }
      const fuera = await this.chequeRepository
        .createQueryBuilder('cheque')
        .where('cheque.idTalonarioCheque = :id', { id: talonario.id })
        .andWhere('(cheque.numero < :ini OR cheque.numero > :fin)', {
          ini: dto.numeroInicial,
          fin: dto.numeroFinal,
        })
        .getCount();
      if (fuera > 0) {
        throw new BadRequestException(
          'El nuevo rango deja fuera cheques del talonario que ya fueron usados.',
        );
      }
    }

    await this.validarSinSolape(
      cuenta.id,
      serie,
      dto.numeroInicial,
      dto.numeroFinal,
      dto.id,
    );

    const datos = {
      serie,
      numeroInicial: dto.numeroInicial,
      numeroFinal: dto.numeroFinal,
      fechaRecepcion: dto.fechaRecepcion,
      fechaVencimiento,
      observacion,
    };

    if (talonario) {
      await this.talonarioRepository.update(talonario.id, {
        ...datos,
        usuarioUltimaModificacion: user.usuario,
      });
    } else {
      talonario = await this.talonarioRepository.save(
        this.talonarioRepository.create({
          ...datos,
          idCuentaBancaria: cuenta.id,
          usuarioRegistro: user.usuario,
        }),
      );
    }

    return this.resumenDeTalonario(talonario.id);
  }

  async cambiarEstadoTalonario(
    id: number,
    activo: boolean,
    user: Usuario,
  ): Promise<ResumenTalonario> {
    const talonario = await this.obtenerTalonario(id);
    if (activo) {
      await this.validarSinSolape(
        talonario.idCuentaBancaria,
        talonario.serie ?? null,
        talonario.numeroInicial,
        talonario.numeroFinal,
        talonario.id,
      );
    }
    await this.talonarioRepository.update(talonario.id, {
      activo,
      usuarioUltimaModificacion: user.usuario,
    });
    return this.resumenDeTalonario(talonario.id);
  }

  /** Talonarios (activos e inactivos) con cuántos cheques les quedan. */
  async listarTalonarios(
    filtro: FiltroTalonarioChequeDto,
  ): Promise<ResumenTalonario[]> {
    const talonarios = await this.talonarioRepository.find({
      where: filtro.idCuentaBancaria
        ? { idCuentaBancaria: filtro.idCuentaBancaria }
        : {},
      order: { fechaRecepcion: 'DESC', id: 'DESC' },
    });
    return this.resumir(this.talonarioRepository.manager, talonarios);
  }

  /**
   * Próximo cheque a usar de una cuenta. El front lo consulta al elegir la
   * forma de pago CHEQUE para proponer el número y avisar cuántos quedan.
   */
  async siguiente(idCuentaBancaria: number): Promise<SiguienteCheque> {
    const cuenta = await this.cuentaRepository.findOne({
      where: { id: idCuentaBancaria },
    });
    if (!cuenta) {
      throw new NotFoundException('No existe la cuenta bancaria indicada.');
    }
    if (!cuenta.manejaCheques) {
      return {
        manejaCheques: false,
        siguienteNumero: null,
        serie: null,
        idTalonarioCheque: null,
        disponibles: 0,
      };
    }

    const resumenes = await this.resumir(
      this.talonarioRepository.manager,
      await this.talonariosActivos(this.talonarioRepository.manager, cuenta.id),
    );
    const conSaldo = resumenes.find((t) => t.disponibles > 0);

    return {
      manejaCheques: true,
      siguienteNumero: conSaldo?.siguienteNumero ?? null,
      serie: conSaldo?.serie ?? null,
      idTalonarioCheque: conSaldo?.id ?? null,
      disponibles: resumenes.reduce((suma, t) => suma + t.disponibles, 0),
    };
  }

  // --------------------------------------------------------------- cheques
  async listarCheques(filtro: FiltroChequeDto): Promise<ChequeListado[]> {
    const query = this.chequeRepository
      .createQueryBuilder('cheque')
      .innerJoinAndSelect('cheque.talonarioCheque', 'talonario')
      .orderBy('cheque.numero', 'DESC')
      .addOrderBy('cheque.id', 'DESC')
      .take(LIMITE_LISTADO_CHEQUES);

    if (filtro.idTalonarioCheque) {
      query.andWhere('cheque.idTalonarioCheque = :idTalonario', {
        idTalonario: filtro.idTalonarioCheque,
      });
    }
    if (filtro.idCuentaBancaria) {
      query.andWhere('talonario.idCuentaBancaria = :idCuenta', {
        idCuenta: filtro.idCuentaBancaria,
      });
    }
    if (filtro.estado) {
      query.andWhere('cheque.estado = :estado', { estado: filtro.estado });
    }

    const hoy = this.hoy();
    return (await query.getMany()).map((cheque) => this.aListado(cheque, hoy));
  }

  /** El banco ya pagó el cheque. */
  async cobrar(
    id: number,
    dto: CobrarChequeDto,
    user: Usuario,
  ): Promise<ChequeListado> {
    const cheque = await this.obtenerCheque(id);
    if (cheque.estado !== 'EMITIDO') {
      throw new BadRequestException(
        `Solo se puede marcar como cobrado un cheque EMITIDO (el N° ${cheque.numero} está ${cheque.estado}).`,
      );
    }
    if (cheque.fechaEmision && dto.fechaCobro < cheque.fechaEmision) {
      throw new BadRequestException(
        'La fecha de cobro no puede ser anterior a la fecha de emisión del cheque.',
      );
    }
    await this.chequeRepository.update(cheque.id, {
      estado: 'COBRADO',
      fechaCobro: dto.fechaCobro,
      usuarioUltimaModificacion: user.usuario,
    });
    return this.aListado(await this.obtenerCheque(id), this.hoy());
  }

  /**
   * Deshace "cobrado" (se marcó por error): el cheque vuelve a EMITIDO.
   */
  async deshacerCobro(id: number, user: Usuario): Promise<ChequeListado> {
    const cheque = await this.obtenerCheque(id);
    if (cheque.estado !== 'COBRADO') {
      throw new BadRequestException(
        `El cheque N° ${cheque.numero} no está marcado como cobrado.`,
      );
    }
    await this.chequeRepository.update(cheque.id, {
      estado: 'EMITIDO',
      fechaCobro: null,
      usuarioUltimaModificacion: user.usuario,
    });
    return this.aListado(await this.obtenerCheque(id), this.hoy());
  }

  /**
   * Revalida un cheque emitido que no se cobró: desde hoy corre un nuevo
   * plazo de 30 días.
   */
  async revalidar(id: number, user: Usuario): Promise<ChequeListado> {
    const cheque = await this.obtenerCheque(id);
    if (cheque.estado !== 'EMITIDO') {
      throw new BadRequestException(
        `Solo se puede revalidar un cheque EMITIDO (el N° ${cheque.numero} está ${cheque.estado}).`,
      );
    }
    const hoy = this.hoy();
    await this.chequeRepository.update(cheque.id, {
      fechaRevalidacion: hoy,
      fechaLimiteCobro: this.sumarDias(hoy, DIAS_COBRO_CHEQUE),
      usuarioUltimaModificacion: user.usuario,
    });
    return this.aListado(await this.obtenerCheque(id), hoy);
  }

  /**
   * Anula un cheque que nunca se usó en un pago (dañado, mal llenado,
   * extraviado). El número se consume igual: no vuelve a estar disponible.
   * Un cheque ya emitido se anula anulando el pago que lo generó.
   */
  async anularEnBlanco(
    dto: AnularChequeEnBlancoDto,
    user: Usuario,
  ): Promise<ChequeListado> {
    const talonario = await this.obtenerTalonario(dto.idTalonarioCheque);
    if (!talonario.activo) {
      throw new BadRequestException('El talonario está inactivo.');
    }
    if (dto.numero < talonario.numeroInicial || dto.numero > talonario.numeroFinal) {
      throw new BadRequestException(
        `El cheque N° ${dto.numero} no pertenece a este talonario (${talonario.numeroInicial} al ${talonario.numeroFinal}).`,
      );
    }
    const usado = await this.chequeRepository.findOne({
      where: { idTalonarioCheque: talonario.id, numero: dto.numero },
    });
    if (usado) {
      throw new ConflictException(
        `El cheque N° ${dto.numero} ya fue utilizado (${usado.estado}).`,
      );
    }
    const cheque = await this.chequeRepository.save(
      this.chequeRepository.create({
        idTalonarioCheque: talonario.id,
        numero: dto.numero,
        estado: 'ANULADO',
        motivoAnulacion: dto.motivo.trim(),
        usuarioRegistro: user.usuario,
      }),
    );
    return this.aListado(await this.obtenerCheque(Number(cheque.id)), this.hoy());
  }

  // ------------------------------------------ enganche con libreta de bancos
  /**
   * Un movimiento nuevo de la libreta que sale de la cuenta con forma de
   * pago CHEQUE consume un cheque del talonario: `nroTransaccion` es el N°
   * de cheque. Si la cuenta no maneja cheques no hace nada (el N° queda
   * como texto libre, igual que antes).
   */
  async registrarEmisionEnTransaccion(
    manager: EntityManager,
    cuenta: CuentaBancaria,
    mov: LibretaBanco,
    user: Usuario,
  ): Promise<void> {
    if (!cuenta.manejaCheques || !this.esPagoConCheque(mov)) return;

    const numero = this.numeroDeCheque(mov.nroTransaccion, cuenta);
    const talonarios = (await this.talonariosActivos(manager, cuenta.id)).filter(
      (t) => numero >= t.numeroInicial && numero <= t.numeroFinal,
    );
    if (talonarios.length === 0) {
      throw new BadRequestException(
        `El cheque N° ${numero} no pertenece a ningún talonario activo de la cuenta ${cuenta.numeroCuenta}. Revisá el número o registrá el talonario en Cuentas y Bancos.`,
      );
    }

    // Con series distintas un mismo número puede estar en dos talonarios: se
    // toma el primero que todavía lo tenga libre.
    let usado: Cheque | null = null;
    for (const talonario of talonarios) {
      const existente = await manager.findOne(Cheque, {
        where: { idTalonarioCheque: talonario.id, numero },
      });
      if (existente) {
        usado = existente;
        continue;
      }
      await manager.save(
        manager.create(Cheque, {
          idTalonarioCheque: talonario.id,
          numero,
          estado: 'EMITIDO',
          fechaEmision: mov.fecha,
          fechaLimiteCobro: this.sumarDias(mov.fecha, DIAS_COBRO_CHEQUE),
          monto: mov.debe,
          beneficiario: mov.nombresApellidos ?? null,
          concepto: mov.concepto ?? null,
          idLibretaBanco: mov.id,
          usuarioRegistro: user.usuario,
        }),
      );
      return;
    }

    throw new BadRequestException(
      `El cheque N° ${numero} de la cuenta ${cuenta.numeroCuenta} ya fue utilizado (${usado.estado}). Usá el siguiente cheque disponible.`,
    );
  }

  /**
   * Al desactivar (anular) el movimiento que emitió un cheque, el cheque
   * queda ANULADO; si el movimiento se reactiva, vuelve a EMITIDO.
   */
  async sincronizarEstadoEnTransaccion(
    manager: EntityManager,
    idLibretaBanco: string,
    activo: boolean,
    user: Usuario,
  ): Promise<void> {
    const cheque = await manager.findOne(Cheque, {
      where: { idLibretaBanco: String(idLibretaBanco) },
    });
    if (!cheque) return;

    if (!activo && cheque.estado !== 'ANULADO') {
      await manager.update(Cheque, cheque.id, {
        estado: 'ANULADO',
        motivoAnulacion: 'Se anuló el movimiento que lo emitió.',
        usuarioUltimaModificacion: user.usuario,
      });
    } else if (activo && cheque.estado === 'ANULADO') {
      await manager.update(Cheque, cheque.id, {
        estado: 'EMITIDO',
        motivoAnulacion: null,
        usuarioUltimaModificacion: user.usuario,
      });
    }
  }

  /**
   * Tras editar un movimiento de la libreta: si ya emitió un cheque, no
   * puede cambiar de número ni dejar de ser un pago con cheque (se actualizan
   * monto, beneficiario, concepto y fecha); si no tenía y ahora es un pago
   * con cheque, lo emite.
   */
  async sincronizarEdicionEnTransaccion(
    manager: EntityManager,
    cuenta: CuentaBancaria,
    mov: LibretaBanco,
    user: Usuario,
  ): Promise<void> {
    const cheque = await manager.findOne(Cheque, {
      where: { idLibretaBanco: String(mov.id) },
    });
    if (!cheque) {
      await this.registrarEmisionEnTransaccion(manager, cuenta, mov, user);
      return;
    }

    const mismoCheque =
      this.esPagoConCheque(mov) &&
      /^\d+$/.test((mov.nroTransaccion ?? '').trim()) &&
      Number(mov.nroTransaccion) === cheque.numero;
    if (!mismoCheque) {
      throw new BadRequestException(
        `Este movimiento emitió el cheque N° ${cheque.numero}. Para cambiar el número o la forma de pago, anulá el movimiento y registralo de nuevo.`,
      );
    }

    await manager.update(Cheque, cheque.id, {
      monto: mov.debe,
      beneficiario: mov.nombresApellidos ?? null,
      concepto: mov.concepto ?? null,
      fechaEmision: mov.fecha,
      // Si ya se revalidó, el plazo corre desde la revalidación.
      ...(cheque.fechaRevalidacion
        ? {}
        : { fechaLimiteCobro: this.sumarDias(mov.fecha, DIAS_COBRO_CHEQUE) }),
      usuarioUltimaModificacion: user.usuario,
    });
  }

  // -------------------------------------------------------------- dashboard
  /**
   * Situación de las chequeras para la pantalla de inicio: por cada cuenta
   * que maneja cheques, cuántos quedan y cuántos emitidos siguen sin cobrar;
   * más las alertas (sin cheques, pocos cheques, emitidos vencidos o por
   * vencer, talonario por vencer).
   */
  async situacionDashboard(): Promise<{
    cuentas: CuentaChequesDashboard[];
    alertas: AlertaCheque[];
  }> {
    const cuentas = await this.cuentaRepository.find({
      where: { manejaCheques: true, activo: true },
      relations: { entidadFinanciera: true },
      order: { id: 'ASC' },
    });
    if (cuentas.length === 0) return { cuentas: [], alertas: [] };

    const hoy = this.hoy();
    const umbralRestantes = this.umbral(
      'CHEQUES_ALERTA_RESTANTES',
      ALERTA_CHEQUES_RESTANTES,
    );
    const diasPorVencer = this.umbral('CHEQUES_ALERTA_DIAS', ALERTA_DIAS_POR_VENCER);
    const limitePorVencer = this.sumarDias(hoy, diasPorVencer);
    const limiteTalonario = this.sumarDias(hoy, ALERTA_DIAS_TALONARIO);

    const manager = this.talonarioRepository.manager;
    const talonarios = await manager.find(TalonarioCheque, {
      where: { idCuentaBancaria: In(cuentas.map((c) => c.id)), activo: true },
    });
    const resumenes = await this.resumir(manager, talonarios);

    const emitidos = await this.chequeRepository
      .createQueryBuilder('cheque')
      .innerJoin('cheque.talonarioCheque', 'talonario')
      .select('talonario.idCuentaBancaria', 'idCuenta')
      .addSelect('COUNT(*)', 'cantidad')
      .addSelect('COALESCE(SUM(cheque.monto), 0)', 'monto')
      .addSelect(
        'COUNT(*) FILTER (WHERE cheque.fechaLimiteCobro < :hoy)',
        'vencidos',
      )
      .addSelect(
        'COUNT(*) FILTER (WHERE cheque.fechaLimiteCobro >= :hoy AND cheque.fechaLimiteCobro <= :limite)',
        'porVencer',
      )
      .where("cheque.estado = 'EMITIDO'")
      .andWhere('talonario.idCuentaBancaria IN (:...ids)', {
        ids: cuentas.map((c) => c.id),
      })
      .setParameters({ hoy, limite: limitePorVencer })
      .groupBy('talonario.idCuentaBancaria')
      .getRawMany<{
        idCuenta: number;
        cantidad: string;
        monto: string;
        vencidos: string;
        porVencer: string;
      }>();
    const emitidosPorCuenta = new Map(emitidos.map((f) => [Number(f.idCuenta), f]));

    const filas: CuentaChequesDashboard[] = cuentas.map((cuenta) => {
      const propios = resumenes.filter((t) => t.idCuentaBancaria === cuenta.id);
      const pendientes = emitidosPorCuenta.get(cuenta.id);
      const vencimientos = propios
        .filter((t) => t.fechaVencimiento && t.disponibles > 0)
        .map((t) => t.fechaVencimiento)
        .sort();
      return {
        idCuentaBancaria: cuenta.id,
        entidadFinanciera: cuenta.entidadFinanciera?.nombre ?? '',
        numeroCuenta: cuenta.numeroCuenta,
        alias: cuenta.alias ?? null,
        moneda: cuenta.moneda,
        disponibles: propios.reduce((suma, t) => suma + t.disponibles, 0),
        total: propios.reduce((suma, t) => suma + t.total, 0),
        emitidosSinCobrar: Number(pendientes?.cantidad ?? 0),
        montoSinCobrar: Number(pendientes?.monto ?? 0),
        porVencer: Number(pendientes?.porVencer ?? 0),
        vencidos: Number(pendientes?.vencidos ?? 0),
        talonarioVence: vencimientos[0] ?? null,
      };
    });

    const nombre = (c: CuentaChequesDashboard) =>
      `${c.entidadFinanciera} ${c.alias || c.numeroCuenta}`.trim();
    const lista = (cs: CuentaChequesDashboard[]) => cs.map(nombre).join(', ');
    const alertas: AlertaCheque[] = [];

    const sinCheques = filas.filter((c) => c.disponibles === 0);
    if (sinCheques.length > 0) {
      alertas.push({
        nivel: 'alta',
        titulo: 'Cuentas sin cheques disponibles',
        detalle: `${lista(sinCheques)}: no queda ningún cheque. Pedí un talonario nuevo al banco y registralo.`,
        cantidad: sinCheques.length,
      });
    }

    const pocos = filas.filter(
      (c) => c.disponibles > 0 && c.disponibles <= umbralRestantes,
    );
    if (pocos.length > 0) {
      alertas.push({
        nivel: 'media',
        titulo: 'Te estás quedando sin cheques',
        detalle: pocos
          .map((c) => `${nombre(c)}: quedan ${c.disponibles}`)
          .join(' · '),
        cantidad: pocos.reduce((suma, c) => suma + c.disponibles, 0),
      });
    }

    const vencidos = filas.reduce((suma, c) => suma + c.vencidos, 0);
    if (vencidos > 0) {
      alertas.push({
        nivel: 'alta',
        titulo: 'Cheques emitidos vencidos sin cobrar',
        detalle: `Pasaron los ${DIAS_COBRO_CHEQUE} días para presentarlos al banco. Si ya se cobraron, marcalos como cobrados; si no, revalidalos o anulá el pago.`,
        cantidad: vencidos,
      });
    }

    const porVencer = filas.reduce((suma, c) => suma + c.porVencer, 0);
    if (porVencer > 0) {
      alertas.push({
        nivel: 'media',
        titulo: 'Cheques emitidos por vencer',
        detalle: `Vencen en ${diasPorVencer} días o menos y todavía no figuran como cobrados.`,
        cantidad: porVencer,
      });
    }

    const talonariosPorVencer = filas.filter(
      (c) => c.talonarioVence && c.talonarioVence <= limiteTalonario,
    );
    if (talonariosPorVencer.length > 0) {
      const yaVencido = talonariosPorVencer.some((c) => c.talonarioVence < hoy);
      alertas.push({
        nivel: yaVencido ? 'alta' : 'media',
        titulo: yaVencido
          ? 'Talonario de cheques vencido'
          : 'Talonario de cheques por vencer',
        detalle: talonariosPorVencer
          .map((c) => `${nombre(c)}: ${this.fechaTexto(c.talonarioVence)}`)
          .join(' · '),
        cantidad: talonariosPorVencer.length,
      });
    }

    return { cuentas: filas, alertas };
  }

  // ---------------------------------------------------------------- helpers
  private async obtenerCuentaConCheques(id: number): Promise<CuentaBancaria> {
    const cuenta = await this.cuentaRepository.findOne({
      where: { id, activo: true },
    });
    if (!cuenta) {
      throw new NotFoundException(
        'No existe la cuenta bancaria indicada o está inactiva.',
      );
    }
    if (!cuenta.manejaCheques) {
      throw new BadRequestException(
        `La cuenta ${cuenta.numeroCuenta} no tiene habilitado el manejo de cheques. Activalo en Cuentas y Bancos.`,
      );
    }
    return cuenta;
  }

  private async obtenerTalonario(id: number): Promise<TalonarioCheque> {
    const talonario = await this.talonarioRepository.findOne({ where: { id } });
    if (!talonario) {
      throw new NotFoundException('No se encontró el talonario solicitado.');
    }
    return talonario;
  }

  private async obtenerCheque(id: number): Promise<Cheque> {
    const cheque = await this.chequeRepository.findOne({
      where: { id: String(id) },
      relations: { talonarioCheque: true },
    });
    if (!cheque) {
      throw new NotFoundException('No se encontró el cheque solicitado.');
    }
    return cheque;
  }

  /** Talonarios activos de una cuenta, del más antiguo al más nuevo. */
  private talonariosActivos(
    manager: EntityManager,
    idCuentaBancaria: number,
  ): Promise<TalonarioCheque[]> {
    return manager.find(TalonarioCheque, {
      where: { idCuentaBancaria, activo: true },
      order: { fechaRecepcion: 'ASC', id: 'ASC' },
    });
  }

  /** Dos talonarios activos de la misma cuenta y serie no pueden pisarse. */
  private async validarSinSolape(
    idCuentaBancaria: number,
    serie: string | null,
    numeroInicial: number,
    numeroFinal: number,
    idExcluir?: number,
  ): Promise<void> {
    const otros = await this.talonariosActivos(
      this.talonarioRepository.manager,
      idCuentaBancaria,
    );
    const choque = otros.find(
      (t) =>
        t.id !== idExcluir &&
        (t.serie ?? null) === serie &&
        numeroInicial <= t.numeroFinal &&
        numeroFinal >= t.numeroInicial,
    );
    if (choque) {
      throw new ConflictException(
        `El rango se superpone con otro talonario activo de la cuenta (${choque.numeroInicial} al ${choque.numeroFinal}).`,
      );
    }
  }

  private async resumenDeTalonario(id: number): Promise<ResumenTalonario> {
    const talonario = await this.obtenerTalonario(id);
    const [resumen] = await this.resumir(this.talonarioRepository.manager, [
      talonario,
    ]);
    return resumen;
  }

  /** Conserva el orden de `talonarios`. */
  private async resumir(
    manager: EntityManager,
    talonarios: TalonarioCheque[],
  ): Promise<ResumenTalonario[]> {
    if (talonarios.length === 0) return [];

    const usados = await manager.find(Cheque, {
      where: { idTalonarioCheque: In(talonarios.map((t) => t.id)) },
      select: { id: true, idTalonarioCheque: true, numero: true, estado: true },
    });
    const porTalonario = new Map<number, Cheque[]>();
    for (const cheque of usados) {
      const lista = porTalonario.get(cheque.idTalonarioCheque) ?? [];
      lista.push(cheque);
      porTalonario.set(cheque.idTalonarioCheque, lista);
    }

    return talonarios.map((talonario) => {
      const propios = porTalonario.get(talonario.id) ?? [];
      const numerosUsados = new Set(propios.map((c) => c.numero));
      const contar = (estado: EstadoCheque) =>
        propios.filter((c) => c.estado === estado).length;
      const total = talonario.numeroFinal - talonario.numeroInicial + 1;

      let siguienteNumero: number | null = null;
      for (let n = talonario.numeroInicial; n <= talonario.numeroFinal; n++) {
        if (!numerosUsados.has(n)) {
          siguienteNumero = n;
          break;
        }
      }

      return {
        id: talonario.id,
        idCuentaBancaria: talonario.idCuentaBancaria,
        serie: talonario.serie ?? null,
        numeroInicial: talonario.numeroInicial,
        numeroFinal: talonario.numeroFinal,
        fechaRecepcion: talonario.fechaRecepcion,
        fechaVencimiento: talonario.fechaVencimiento ?? null,
        observacion: talonario.observacion ?? null,
        activo: talonario.activo,
        total,
        emitidos: contar('EMITIDO'),
        cobrados: contar('COBRADO'),
        anulados: contar('ANULADO'),
        disponibles: total - numerosUsados.size,
        siguienteNumero,
      };
    });
  }

  private aListado(cheque: Cheque, hoy: string): ChequeListado {
    const emitido = cheque.estado === 'EMITIDO' && !!cheque.fechaLimiteCobro;
    const diasParaVencer = emitido
      ? this.diasEntre(hoy, cheque.fechaLimiteCobro)
      : null;
    const { talonarioCheque, ...datos } = cheque;
    return {
      ...datos,
      idCuentaBancaria: talonarioCheque?.idCuentaBancaria,
      serie: talonarioCheque?.serie ?? null,
      vencido: diasParaVencer !== null && diasParaVencer < 0,
      diasParaVencer,
    } as ChequeListado;
  }

  /** Sale plata de la cuenta (DEBE) con forma de pago CHEQUE. */
  private esPagoConCheque(mov: LibretaBanco): boolean {
    return (
      (mov.tipoTransaccion ?? '').trim().toUpperCase() === 'CHEQUE' &&
      Number(mov.debe) > 0
    );
  }

  private numeroDeCheque(
    nroTransaccion: string | null | undefined,
    cuenta: CuentaBancaria,
  ): number {
    const texto = (nroTransaccion ?? '').trim();
    if (!/^\d+$/.test(texto)) {
      throw new BadRequestException(
        `La cuenta ${cuenta.numeroCuenta} maneja chequera: el pago con cheque requiere el N° de cheque (solo números) como N° de comprobante.`,
      );
    }
    return Number(texto);
  }

  private umbral(clave: string, porDefecto: number): number {
    const valor = Number(this.configService.get(clave));
    return Number.isFinite(valor) && valor > 0 ? valor : porDefecto;
  }

  /** Fecha de hoy en Bolivia (UTC-4), "YYYY-MM-DD". */
  private hoy(): string {
    return new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString().slice(0, 10);
  }

  private sumarDias(fecha: string, dias: number): string {
    const base = new Date(`${fecha.slice(0, 10)}T00:00:00Z`);
    base.setUTCDate(base.getUTCDate() + dias);
    return base.toISOString().slice(0, 10);
  }

  private diasEntre(desde: string, hasta: string): number {
    const a = Date.parse(`${desde.slice(0, 10)}T00:00:00Z`);
    const b = Date.parse(`${hasta.slice(0, 10)}T00:00:00Z`);
    return Math.round((b - a) / 86_400_000);
  }

  private fechaTexto(fecha: string): string {
    const [a, m, d] = fecha.slice(0, 10).split('-');
    return `${d}/${m}/${a}`;
  }
}
