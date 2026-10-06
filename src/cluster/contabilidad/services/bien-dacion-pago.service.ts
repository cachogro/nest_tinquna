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
import { Caja } from 'src/cluster/parametricas/entities/caja.entity';
import { CuentaBancaria } from 'src/cluster/parametricas/entities/cuenta-bancaria.entity';
import { DestinoGasto } from 'src/cluster/parametricas/entities/destino-gasto.entity';
import { FormaPago } from 'src/cluster/parametricas/entities/forma-pago.entity';
import { Kardex } from '../entities/kardex.entity';
import { MovimientoCaja } from '../entities/movimiento-caja.entity';
import { LibretaBanco } from '../entities/libreta-banco.entity';
import { BienDacionPago } from '../entities/bien-dacion-pago.entity';
import { BienDacionPagoGasto } from '../entities/bien-dacion-pago-gasto.entity';
import { CreateBienDacionPagoDto } from '../dto/bien-dacion-pago/create-bien-dacion-pago.dto';
import { VenderBienDacionPagoDto } from '../dto/bien-dacion-pago/vender-bien-dacion-pago.dto';
import { DevolverBienDacionPagoDto } from '../dto/bien-dacion-pago/devolver-bien-dacion-pago.dto';
import { TomarEnPagoBienDacionPagoDto } from '../dto/bien-dacion-pago/tomar-en-pago-bien-dacion-pago.dto';
import { CreateBienDacionPagoGastoDto } from '../dto/bien-dacion-pago/create-bien-dacion-pago-gasto.dto';
import { FiltroBienDacionPagoDto } from '../dto/bien-dacion-pago/filtro-bien-dacion-pago.dto';
import { DatosPagoDto } from '../dto/prestamo-personal/datos-pago.dto';
import { KardexActividadService } from './kardex-actividad.service';
import { MovimientoCajaService } from './movimiento-caja.service';
import { LibretaBancoService } from './libreta-banco.service';
import { MovimientoKardexService } from './movimiento-kardex.service';
import { PersonaAutorizo, resolverPersonaAutorizo } from '../persona-autorizo.util';
import { validarMonedaCuenta } from '../moneda.util';

const RELACIONES = {
  persona: true,
  actorProductivoMinero: true,
  recibo: true,
  gastos: { destinoGasto: true },
} as const;

// La caja de flujo de la empresa (Caja id=1, "CAJA PRINCIPAL"): mismo
// criterio que recibos, traspasos y pagos de valorización.
const ID_CAJA_EMPRESA = 1;
const FORMAS_PAGO_BANCARIAS = ['QR', 'TRANSFERENCIA', 'CHEQUE', 'DEPOSITO'];
// Los bienes en dación y el kardex se manejan en Bs.
const MONEDA = 'BS' as const;

/** Por dónde se mueve la plata de una venta o de un gasto, ya validado. */
interface MedioPago {
  formaPago: FormaPago;
  /** Con cuenta => libreta de bancos; sin cuenta => `caja` (efectivo). */
  cuentaBancaria: CuentaBancaria | null;
  caja: Caja | null;
  nroComprobante: string | null;
  idDestinoGasto: number | null;
  personaAutorizo: PersonaAutorizo;
}

/**
 * Bienes recibidos en dación de pago (ver `BienDacionPago`).
 *
 *  - Registrar o devolver el bien no mueve kardex ni caja.
 *  - Tomarlo en pago abona el valor acordado al kardex del dueño (HABER),
 *    sin mover caja: desde ahí el bien es de la empresa.
 *  - Los gastos de un bien tomado en pago son egresos directos de caja o
 *    libreta; no tocan el kardex.
 *  - Venderlo ingresa el precio DIRECTO a la caja de flujo o a la libreta de
 *    bancos, sin recibo. Si se vende sin haberlo tomado en pago (venta
 *    directa), en el mismo paso se abona al kardex lo que se amortiza.
 */
@Injectable()
export class BienDacionPagoService {
  constructor(
    @InjectRepository(BienDacionPago, 'ci')
    private readonly bienRepository: Repository<BienDacionPago>,

    @InjectRepository(BienDacionPagoGasto, 'ci')
    private readonly gastoRepository: Repository<BienDacionPagoGasto>,

    @InjectRepository(PersonaCi, 'ci')
    private readonly personaRepository: Repository<PersonaCi>,

    @InjectRepository(ActorProductivoMinero, 'ci')
    private readonly actorRepository: Repository<ActorProductivoMinero>,

    @InjectRepository(Kardex, 'ci')
    private readonly kardexRepository: Repository<Kardex>,

    private readonly kardexActividadService: KardexActividadService,
    private readonly movimientoCajaService: MovimientoCajaService,
    private readonly libretaBancoService: LibretaBancoService,
    private readonly movimientoKardexService: MovimientoKardexService,

    @InjectDataSource('ci')
    private readonly dataSource: DataSource,
  ) {}

  // ------------------------------------------------------------------ helpers
  private r2(n: number | string | null | undefined): number {
    return Math.round((Number(n ?? 0) + Number.EPSILON) * 100) / 100;
  }

  /**
   * Valida al dueño del bien (persona o actor, excluyentes, activo) y
   * devuelve su kardex ABIERTO y activo; falla si no tiene.
   */
  private async kardexAbiertoDelDueno(
    dto: { idPersona?: string | null; idActorProductivoMinero?: string | null },
    accion: string,
  ): Promise<Kardex> {
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

    let kardex: Kardex | null;
    if (dto.idPersona) {
      const persona = await this.personaRepository.findOne({
        where: { id: String(dto.idPersona) },
      });
      if (!persona) {
        throw new NotFoundException('No se encontró la persona.');
      }
      if (!persona.activo) {
        throw new BadRequestException('La persona está inactiva.');
      }
      kardex = await this.kardexRepository.findOne({
        where: [
          { tipo: 'PERSONAL', idPersona: persona.id, estado: 'ABIERTO' },
          { tipo: 'ASOCIADO', idPersona: persona.id, estado: 'ABIERTO' },
        ],
      });
      if (!kardex) {
        throw new BadRequestException(
          `Esta persona no tiene un kardex ABIERTO. Abrí uno (POST /contabilidad/kardex) antes de ${accion}.`,
        );
      }
    } else {
      const actor = await this.actorRepository.findOne({
        where: { id: String(dto.idActorProductivoMinero) },
      });
      if (!actor) {
        throw new NotFoundException('No se encontró el actor productivo minero.');
      }
      if (!actor.activo) {
        throw new BadRequestException('El actor productivo minero está inactivo.');
      }
      kardex = await this.kardexRepository.findOne({
        where: {
          tipo: 'ACTOR',
          idActorProductivoMinero: actor.id,
          estado: 'ABIERTO',
        },
      });
      if (!kardex) {
        throw new BadRequestException(
          `Este actor productivo minero no tiene un kardex ABIERTO. Abrí uno (POST /contabilidad/kardex) antes de ${accion}.`,
        );
      }
    }
    await this.kardexActividadService.validarActivo(kardex);
    return kardex;
  }

  private etiquetaEstado(bien: BienDacionPago): string {
    return bien.estado === 'TOMADO_EN_PAGO' ? 'TOMADO EN PAGO' : bien.estado;
  }

  private async obtenerEnEstado(
    id: string,
    estados: BienDacionPago['estado'][],
    accion: string,
  ): Promise<BienDacionPago> {
    const bien = await this.bienRepository.findOne({
      where: { id },
      relations: { persona: true, actorProductivoMinero: true },
    });
    if (!bien) {
      throw new NotFoundException('No se encontró el bien.');
    }
    if (!estados.includes(bien.estado)) {
      throw new BadRequestException(
        `Este bien está ${this.etiquetaEstado(bien)}: no se puede ${accion}.`,
      );
    }
    return bien;
  }

  private nombreDueno(bien: BienDacionPago): string {
    if (bien.actorProductivoMinero) return bien.actorProductivoMinero.nombre;
    const p = bien.persona;
    return [p?.nombres, p?.apellidoPaterno, p?.apellidoMaterno]
      .filter(Boolean)
      .join(' ')
      .trim();
  }

  /**
   * Valida los datos de pago antes de abrir la transacción: forma de pago,
   * cuenta bancaria + comprobante si el medio es bancario (o la caja de la
   * empresa aperturada si es efectivo), destino del gasto y quién autorizó.
   */
  private async resolverMedioPago(dto: DatosPagoDto, documento: string): Promise<MedioPago> {
    const personaAutorizo = await resolverPersonaAutorizo(
      this.personaRepository,
      dto.idPersonaAutorizo,
      documento,
    );
    if (!dto.idFormaPago) {
      throw new BadRequestException('Indicá la forma de pago.');
    }
    const formaPago = await this.dataSource.manager.findOne(FormaPago, {
      where: { id: dto.idFormaPago },
    });
    if (!formaPago) {
      throw new NotFoundException('No existe la forma de pago seleccionada.');
    }

    const nroComprobante = dto.nroComprobante?.trim().toUpperCase() || null;
    let cuentaBancaria: CuentaBancaria | null = null;
    if (FORMAS_PAGO_BANCARIAS.includes(formaPago.codigo)) {
      if (!dto.idCuentaBancaria) {
        throw new BadRequestException(
          `La forma de pago ${formaPago.nombre} requiere indicar la cuenta bancaria.`,
        );
      }
      if (!nroComprobante) {
        throw new BadRequestException(
          `La forma de pago ${formaPago.nombre} requiere el N° de comprobante.`,
        );
      }
      cuentaBancaria = await this.dataSource.manager.findOne(CuentaBancaria, {
        where: { id: dto.idCuentaBancaria },
      });
      if (!cuentaBancaria) {
        throw new NotFoundException('No existe la cuenta bancaria seleccionada.');
      }
      validarMonedaCuenta(cuentaBancaria, MONEDA);
      await this.libretaBancoService.obtenerCuentaAperturada(cuentaBancaria.id);
    }

    let idDestinoGasto: number | null = null;
    if (dto.idDestinoGasto) {
      const destino = await this.dataSource.manager.findOne(DestinoGasto, {
        where: { id: dto.idDestinoGasto },
      });
      if (!destino) {
        throw new NotFoundException('El destino del gasto seleccionado no existe.');
      }
      idDestinoGasto = destino.id;
    }

    const caja = cuentaBancaria
      ? null
      : await this.movimientoCajaService.obtenerCajaAperturada(ID_CAJA_EMPRESA, MONEDA);

    return { formaPago, cuentaBancaria, caja, nroComprobante, idDestinoGasto, personaAutorizo };
  }

  /**
   * Ingreso o egreso directo (sin recibo): a la libreta de bancos si el
   * medio trae cuenta bancaria, o a la caja de flujo si es efectivo.
   */
  private async moverDinero(
    manager: EntityManager,
    medio: MedioPago,
    datos: {
      fecha: string;
      concepto: string;
      referencia: string;
      aNombreDe: string;
      ingreso: number;
      egreso: number;
    },
    user: Usuario,
  ): Promise<{ idMovimientoCaja: string | null; idLibretaBanco: string | null }> {
    if (medio.cuentaBancaria) {
      // En la libreta, HABER es entrada y DEBE es salida.
      const mov = await this.libretaBancoService.crearMovimientoEnTransaccion(
        manager,
        medio.cuentaBancaria,
        {
          fecha: datos.fecha,
          nroTransaccion: medio.nroComprobante,
          tipoTransaccion: medio.formaPago.nombre,
          facturaRecibo: datos.referencia,
          nombresApellidos: datos.aNombreDe,
          concepto: datos.concepto,
          idDestinoGasto: medio.idDestinoGasto,
          debe: datos.egreso,
          haber: datos.ingreso,
        },
        user,
      );
      return { idMovimientoCaja: null, idLibretaBanco: mov.id };
    }
    const mov = await this.movimientoCajaService.crearMovimientoEnTransaccion(
      manager,
      medio.caja!,
      {
        moneda: MONEDA,
        fecha: datos.fecha,
        nroComprobante: medio.nroComprobante,
        facturaRecibo: datos.referencia,
        idFormaPago: medio.formaPago.id,
        entregaFondosA: datos.aNombreDe,
        concepto: datos.concepto,
        idDestinoGasto: medio.idDestinoGasto,
        ingreso: datos.ingreso,
        egreso: datos.egreso,
      },
      user,
    );
    return { idMovimientoCaja: mov.id, idLibretaBanco: null };
  }

  /** Referencia corta que queda en el movimiento de caja/banco y en el kardex. */
  private referencia(bien: BienDacionPago): string {
    return `BIEN:${bien.id}`;
  }

  /**
   * Números del bien que no se guardan: lo gastado, lo que le costó a la
   * empresa (amortizado + gastos) y, si ya se vendió, el resultado.
   */
  private conTotales(bien: BienDacionPago) {
    const totalGastos = this.r2(
      (bien.gastos ?? [])
        .filter((g) => g.activo)
        .reduce((s, g) => s + Number(g.monto), 0),
    );
    const amortizado = bien.montoAmortizado != null ? this.r2(bien.montoAmortizado) : null;
    const costoTotal = amortizado != null ? this.r2(amortizado + totalGastos) : null;
    const resultadoVenta =
      bien.estado === 'VENDIDO' && costoTotal != null && bien.montoVenta != null
        ? this.r2(Number(bien.montoVenta) - costoTotal)
        : null;
    return { ...bien, totalGastos, costoTotal, resultadoVenta };
  }

  // ------------------------------------------------------------------ CRUD
  async registrar(dto: CreateBienDacionPagoDto, user: Usuario) {
    await this.kardexAbiertoDelDueno(dto, 'registrar el bien');

    const bien = this.bienRepository.create({
      idPersona: dto.idPersona ?? null,
      idActorProductivoMinero: dto.idActorProductivoMinero ?? null,
      fechaRecepcion: dto.fechaRecepcion,
      descripcion: dto.descripcion.trim(),
      valorReferencial: this.r2(dto.valorReferencial),
      estado: 'EN_POSESION',
      observaciones: dto.observaciones?.trim() || null,
      usuarioRegistro: user.usuario,
    });
    const guardado = await this.bienRepository.save(bien);

    return this.buscarPorId(guardado.id);
  }

  /**
   * La empresa se queda con el bien: abona el valor acordado al kardex del
   * dueño (HABER, sin movimiento de caja) y lo pasa a TOMADO_EN_PAGO. Desde
   * acá ya no se devuelve; se le pueden cargar gastos y venderlo.
   */
  async tomarEnPago(id: string, dto: TomarEnPagoBienDacionPagoDto, user: Usuario) {
    const bien = await this.obtenerEnEstado(id, ['EN_POSESION'], 'tomar en pago');
    const kardex = await this.kardexAbiertoDelDueno(bien, 'tomar el bien en pago');

    const monto = this.r2(dto.montoAmortizar ?? bien.valorReferencial);
    if (!(monto > 0)) {
      throw new BadRequestException(
        'Este bien no tiene valor acordado: indicá el monto que se abona al kardex (montoAmortizar).',
      );
    }

    await this.dataSource.transaction(async (manager) => {
      const linea =
        await this.movimientoKardexService.crearLineaSinMovimientoDineroEnTransaccion(
          manager,
          kardex,
          {
            fecha: dto.fecha,
            detalle: `DACIÓN EN PAGO: ${bien.descripcion}`.slice(0, 255),
            facturaRecibo: this.referencia(bien),
            debe: 0,
            haber: monto,
            usuarioRegistro: user.usuario,
          },
        );

      await manager.update(BienDacionPago, bien.id, {
        estado: 'TOMADO_EN_PAGO',
        fechaTomaPago: dto.fecha,
        montoAmortizado: monto,
        idMovimientoKardex: linea.id,
        observaciones: dto.observaciones?.trim() || bien.observaciones,
        usuarioUltimaModificacion: user.usuario,
      });
    });

    return this.buscarPorId(bien.id);
  }

  /**
   * Vende el bien: el precio entra directo a la caja de flujo o a la libreta
   * de bancos (sin recibo).
   *
   *  - Bien TOMADO_EN_PAGO: el kardex ya se abonó al tomarlo; acá solo entra
   *    el dinero.
   *  - Bien EN_POSESION (venta directa): además abona al kardex del dueño lo
   *    que se amortiza — por defecto el valor acordado, o el precio si se
   *    vendió por menos. Lo que sobre del precio es ganancia de la empresa.
   */
  async vender(id: string, dto: VenderBienDacionPagoDto, user: Usuario) {
    const bien = await this.obtenerEnEstado(
      id,
      ['EN_POSESION', 'TOMADO_EN_PAGO'],
      'vender',
    );
    const ventaDirecta = bien.estado === 'EN_POSESION';
    const montoVenta = this.r2(dto.montoVenta);

    let kardex: Kardex | null = null;
    let montoAmortizar = this.r2(bien.montoAmortizado);
    if (ventaDirecta) {
      // El kardex del dueño tiene que estar abierto para recibir el HABER.
      kardex = await this.kardexAbiertoDelDueno(bien, 'vender el bien');
      const acordado = this.r2(bien.valorReferencial);
      montoAmortizar = this.r2(
        dto.montoAmortizar ??
          (acordado > 0 ? Math.min(acordado, montoVenta) : montoVenta),
      );
    }

    const medio = await this.resolverMedioPago(dto, 'la venta');
    const dueno = this.nombreDueno(bien);
    const excedente = this.r2(montoVenta - montoAmortizar);
    const concepto = (
      ventaDirecta
        ? `VENTA DE BIEN EN DACIÓN DE PAGO: ${bien.descripcion} (AMORTIZA Bs ${montoAmortizar.toFixed(2)} A ${dueno})`
        : `VENTA DE BIEN TOMADO EN PAGO: ${bien.descripcion}`
    ).slice(0, 255);

    await this.dataSource.transaction(async (manager) => {
      let idMovimientoKardex = bien.idMovimientoKardex ?? null;
      if (kardex) {
        const linea =
          await this.movimientoKardexService.crearLineaSinMovimientoDineroEnTransaccion(
            manager,
            kardex,
            {
              fecha: dto.fechaVenta,
              detalle: `VENTA DE BIEN EN DACIÓN DE PAGO: ${bien.descripcion}`.slice(0, 255),
              facturaRecibo: this.referencia(bien),
              debe: 0,
              haber: montoAmortizar,
              usuarioRegistro: user.usuario,
            },
          );
        idMovimientoKardex = linea.id;
      }

      const movimientos = await this.moverDinero(
        manager,
        medio,
        {
          fecha: dto.fechaVenta,
          concepto,
          referencia: this.referencia(bien),
          aNombreDe: excedente > 0 && ventaDirecta ? `${dueno} (EXCEDENTE Bs ${excedente.toFixed(2)})` : dueno,
          ingreso: montoVenta,
          egreso: 0,
        },
        user,
      );

      await manager.update(BienDacionPago, bien.id, {
        estado: 'VENDIDO',
        fechaVenta: dto.fechaVenta,
        montoVenta,
        montoAmortizado: montoAmortizar,
        idMovimientoKardex,
        ...movimientos,
        personaAutorizo: medio.personaAutorizo,
        observaciones: dto.observaciones?.trim() || bien.observaciones,
        usuarioUltimaModificacion: user.usuario,
      });
    });

    return this.buscarPorId(bien.id);
  }

  /** Devolución al dueño: solo mientras el bien está EN_POSESION. No genera nada. */
  async devolver(id: string, dto: DevolverBienDacionPagoDto, user: Usuario) {
    const bien = await this.obtenerEnEstado(id, ['EN_POSESION'], 'devolver');

    await this.bienRepository.update(bien.id, {
      estado: 'DEVUELTO',
      fechaDevolucion: dto.fechaDevolucion,
      observaciones: dto.observaciones.trim(),
      usuarioUltimaModificacion: user.usuario,
    });

    return this.buscarPorId(bien.id);
  }

  // ------------------------------------------------------------------ gastos
  /**
   * Gasto que la empresa le invierte al bien (arreglos, trámites...): egreso
   * directo de caja o libreta, sin recibo. Solo con el bien TOMADO_EN_PAGO
   * (antes no es de la empresa; vendido, ya no tiene sentido).
   */
  async registrarGasto(id: string, dto: CreateBienDacionPagoGastoDto, user: Usuario) {
    const bien = await this.obtenerEnEstado(id, ['TOMADO_EN_PAGO'], 'cargarle gastos');
    const medio = await this.resolverMedioPago(dto, 'el gasto');
    const monto = this.r2(dto.monto);
    const concepto = dto.concepto.trim();

    await this.dataSource.transaction(async (manager) => {
      const movimientos = await this.moverDinero(
        manager,
        medio,
        {
          fecha: dto.fecha,
          concepto: `${concepto} - BIEN TOMADO EN PAGO: ${bien.descripcion}`.slice(0, 255),
          referencia: this.referencia(bien),
          aNombreDe: 'GASTO DE BIEN TOMADO EN PAGO',
          ingreso: 0,
          egreso: monto,
        },
        user,
      );

      await manager.save(
        manager.create(BienDacionPagoGasto, {
          idBienDacionPago: bien.id,
          fecha: dto.fecha,
          concepto,
          monto,
          idDestinoGasto: medio.idDestinoGasto,
          ...movimientos,
          personaAutorizo: medio.personaAutorizo,
          usuarioRegistro: user.usuario,
        }),
      );
    });

    return this.buscarPorId(bien.id);
  }

  /**
   * Anula un gasto cargado por error: da de baja su egreso de caja o libreta
   * (el saldo se recalcula) y deja de contar en el costo del bien. Solo
   * mientras el bien sigue TOMADO_EN_PAGO y el período del movimiento abierto.
   */
  async anularGasto(idGasto: string, user: Usuario) {
    const gasto = await this.gastoRepository.findOne({ where: { id: idGasto } });
    if (!gasto) {
      throw new NotFoundException('No se encontró el gasto.');
    }
    if (!gasto.activo) {
      throw new BadRequestException('Este gasto ya está anulado.');
    }
    const bien = await this.obtenerEnEstado(
      gasto.idBienDacionPago,
      ['TOMADO_EN_PAGO'],
      'anular sus gastos',
    );

    const movCaja = gasto.idMovimientoCaja
      ? await this.dataSource.manager.findOne(MovimientoCaja, {
          where: { id: gasto.idMovimientoCaja },
          relations: { periodoCaja: true },
        })
      : null;
    const movBanco = gasto.idLibretaBanco
      ? await this.dataSource.manager.findOne(LibretaBanco, {
          where: { id: gasto.idLibretaBanco },
          relations: { periodoBanco: true },
        })
      : null;
    if (
      movCaja?.periodoCaja?.estado === 'CERRADO' ||
      movBanco?.periodoBanco?.estado === 'CERRADO'
    ) {
      throw new BadRequestException(
        'El egreso de este gasto pertenece a un período cerrado: no se puede anular.',
      );
    }

    await this.dataSource.transaction(async (manager) => {
      if (movCaja) {
        await this.movimientoCajaService.cambiarEstadoEnTransaccion(manager, movCaja, false, user);
      }
      if (movBanco) {
        await this.libretaBancoService.cambiarEstadoEnTransaccion(manager, movBanco, false, user);
      }
      await manager.update(BienDacionPagoGasto, gasto.id, {
        activo: false,
        usuarioUltimaModificacion: user.usuario,
      });
    });

    return this.buscarPorId(bien.id);
  }

  // ------------------------------------------------------------------ lectura
  async buscarPorId(id: string) {
    const bien = await this.bienRepository.findOne({
      where: { id },
      relations: RELACIONES,
      order: { gastos: { fecha: 'ASC', id: 'ASC' } },
    });
    if (!bien) {
      throw new NotFoundException('No se encontró el bien.');
    }
    return this.conTotales(bien);
  }

  async listar(filtro: FiltroBienDacionPagoDto) {
    const page = filtro.page ?? 1;
    const limit = filtro.limit ?? 10;

    const qb = this.bienRepository
      .createQueryBuilder('b')
      .leftJoinAndSelect('b.persona', 'persona')
      .leftJoinAndSelect('b.actorProductivoMinero', 'actor')
      .leftJoinAndSelect('b.recibo', 'recibo');

    if (filtro.idPersona) {
      qb.andWhere('b.idPersona = :idPersona', { idPersona: filtro.idPersona });
    }
    if (filtro.idActorProductivoMinero) {
      qb.andWhere('b.idActorProductivoMinero = :idActor', {
        idActor: filtro.idActorProductivoMinero,
      });
    }
    if (filtro.estado) {
      qb.andWhere('b.estado = :estado', { estado: filtro.estado });
    }
    if (filtro.fechaDesde) {
      qb.andWhere('b.fechaRecepcion >= :desde', { desde: filtro.fechaDesde });
    }
    if (filtro.fechaHasta) {
      qb.andWhere('b.fechaRecepcion <= :hasta', { hasta: filtro.fechaHasta });
    }

    qb.orderBy('b.fechaRecepcion', 'DESC').addOrderBy('b.id', 'DESC');
    qb.skip((page - 1) * limit).take(limit);

    const [bienes, total] = await qb.getManyAndCount();

    // Gastos de los bienes de la página en una sola consulta (evita N+1).
    const ids = bienes.map((b) => b.id);
    const gastos = ids.length
      ? await this.gastoRepository
          .createQueryBuilder('g')
          .leftJoinAndSelect('g.destinoGasto', 'dg')
          .where('g.idBienDacionPago IN (:...ids)', { ids })
          .orderBy('g.fecha', 'ASC')
          .addOrderBy('g.id', 'ASC')
          .getMany()
      : [];
    const data = bienes.map((b) =>
      this.conTotales({
        ...b,
        gastos: gastos.filter((g) => g.idBienDacionPago === b.id),
      } as BienDacionPago),
    );

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
