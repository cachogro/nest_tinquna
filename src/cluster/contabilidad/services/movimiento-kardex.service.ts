import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';

import { Usuario } from 'src/security/entities/usuario.entity';
import { KardexSubcuenta } from 'src/cluster/parametricas/entities/kardex-subcuenta.entity';
import { FormaPago } from 'src/cluster/parametricas/entities/forma-pago.entity';
import { DestinoGasto } from 'src/cluster/parametricas/entities/destino-gasto.entity';
import { PersonaCi } from 'src/cluster/comercio-interno/entities/persona-ci.entity';
import { ValorizacionMineral } from 'src/cluster/comercio-interno/entities/valorizacion/valorizacion-mineral.entity';
import { CuentaBancaria } from 'src/cluster/parametricas/entities/cuenta-bancaria.entity';
import { Caja } from 'src/cluster/parametricas/entities/caja.entity';
import { Kardex } from '../entities/kardex.entity';
import { MovimientoKardex } from '../entities/movimiento-kardex.entity';
import { CreateMovimientoKardexDto } from '../dto/movimiento-kardex/create-movimiento-kardex.dto';
import { FiltroMovimientoKardexDto } from '../dto/movimiento-kardex/filtro-movimiento-kardex.dto';
import { KardexActividadService } from './kardex-actividad.service';
import { MovimientoCajaService } from './movimiento-caja.service';
import { LibretaBancoService } from './libreta-banco.service';
import { MonedaCaja } from '../entities/periodo-caja.entity';
import { aBolivianos, resolverTipoCambio, validarMonedaCuenta } from '../moneda.util';

const RELACIONES = {
  subcuenta: true,
  formaPago: true,
  destinoGasto: true,
  cobrador: true,
  valorizacion: true,
  cuentaBancaria: { entidadFinanciera: true },
  movimientosCaja: { destinoGasto: true },
} as const;

// La caja de flujo (Caja id=1, "CAJA PRINCIPAL") es el registro maestro de
// la empresa: un movimiento de kardex cargado directamente también se
// refleja acá, en la moneda del movimiento (el kardex lleva su saldo en Bs.;
// la caja recibe el monto original, en BS o en USD).
const ID_CAJA_EMPRESA = 1;

@Injectable()
export class MovimientoKardexService {
  constructor(
    @InjectRepository(MovimientoKardex, 'ci')
    private readonly movimientoRepository: Repository<MovimientoKardex>,

    @InjectRepository(Kardex, 'ci')
    private readonly kardexRepository: Repository<Kardex>,

    @InjectRepository(KardexSubcuenta, 'ci')
    private readonly subcuentaRepository: Repository<KardexSubcuenta>,

    @InjectRepository(FormaPago, 'ci')
    private readonly formaPagoRepository: Repository<FormaPago>,

    @InjectRepository(DestinoGasto, 'ci')
    private readonly destinoGastoRepository: Repository<DestinoGasto>,

    @InjectRepository(PersonaCi, 'ci')
    private readonly personaRepository: Repository<PersonaCi>,

    @InjectRepository(ValorizacionMineral, 'ci')
    private readonly valorizacionRepository: Repository<ValorizacionMineral>,

    @InjectRepository(CuentaBancaria, 'ci')
    private readonly cuentaBancariaRepository: Repository<CuentaBancaria>,

    private readonly movimientoCajaService: MovimientoCajaService,
    private readonly libretaBancoService: LibretaBancoService,
    private readonly kardexActividadService: KardexActividadService,

    @InjectDataSource('ci')
    private readonly dataSource: DataSource,
  ) {}

  // ------------------------------------------------------------------ helpers
  private r2(n: number): number {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  /**
   * Importes de la línea: `debe`/`haber` siempre en Bs. (el saldo del kardex
   * es en Bs.) y, si el movimiento es en USD, el original en
   * `debeUsd`/`haberUsd`.
   */
  private importes(dto: CreateMovimientoKardexDto): {
    moneda: MonedaCaja;
    tipoCambio: number | null;
    debe: number;
    haber: number;
    debeUsd: number;
    haberUsd: number;
  } {
    const moneda: MonedaCaja = dto.moneda ?? 'BS';
    const tipoCambio = resolverTipoCambio(moneda, dto.tipoCambio);
    const monto = this.r2(Number(dto.monto));
    const montoBs = aBolivianos(monto, moneda, tipoCambio);
    const montoUsd = moneda === 'USD' ? monto : 0;
    return dto.tipo === 'DEBE'
      ? { moneda, tipoCambio, debe: montoBs, haber: 0, debeUsd: montoUsd, haberUsd: 0 }
      : { moneda, tipoCambio, debe: 0, haber: montoBs, debeUsd: 0, haberUsd: montoUsd };
  }

  private async obtenerKardexAbierto(idKardex: string): Promise<Kardex> {
    const kardex = await this.kardexRepository.findOne({
      where: { id: idKardex },
      relations: { persona: true, actorProductivoMinero: true, cliente: true },
    });
    if (!kardex) {
      throw new NotFoundException('No se encontró el kardex.');
    }
    if (kardex.estado === 'CERRADO') {
      throw new BadRequestException(
        `El kardex ${kardex.codigo} está cerrado. Registrá el movimiento en el kardex abierto.`,
      );
    }
    return kardex;
  }

  /**
   * Beneficiario a guardar en el movimiento de caja generado: el titular
   * real del kardex afectado (persona o actor), no un dato aparte.
   */
  private datosBeneficiarioKardex(
    kardex: Kardex,
  ): { idPersona: string | null; entregaFondosA: string | null } {
    if (
      (kardex.tipo === 'PERSONAL' || kardex.tipo === 'ASOCIADO') &&
      kardex.persona
    ) {
      const nombre = [
        kardex.persona.nombres,
        kardex.persona.apellidoPaterno,
        kardex.persona.apellidoMaterno,
      ]
        .filter(Boolean)
        .join(' ')
        .trim()
        .toUpperCase();
      return { idPersona: kardex.persona.id, entregaFondosA: nombre || null };
    }
    if (kardex.tipo === 'ACTOR' && kardex.actorProductivoMinero) {
      return {
        idPersona: null,
        entregaFondosA: kardex.actorProductivoMinero.nombre?.toUpperCase() ?? null,
      };
    }
    if (kardex.tipo === 'CLIENTE' && kardex.cliente) {
      return {
        idPersona: null,
        entregaFondosA: kardex.cliente.nombre?.toUpperCase() ?? null,
      };
    }
    return { idPersona: null, entregaFondosA: null };
  }

  /**
   * Solo valida que la cuenta exista y esté activa (uso puramente
   * informativo si no hay nada que postear en libreta_banco). La
   * validación de "aperturada" se hace aparte, justo antes de postear.
   */
  private async resolverCuentaBancariaOpcional(
    idCuentaBancaria?: number,
  ): Promise<CuentaBancaria | null> {
    if (!idCuentaBancaria) {
      return null;
    }
    const cuentaBancaria = await this.cuentaBancariaRepository.findOne({
      where: { id: idCuentaBancaria },
    });
    if (!cuentaBancaria) {
      throw new NotFoundException('No existe la cuenta bancaria seleccionada.');
    }
    return cuentaBancaria;
  }

  private async resolverFormaPagoOpcional(
    idFormaPago?: number,
  ): Promise<FormaPago | null> {
    if (!idFormaPago) {
      return null;
    }
    const formaPago = await this.formaPagoRepository.findOne({
      where: { id: idFormaPago },
    });
    if (!formaPago) {
      throw new NotFoundException('No existe la forma de pago seleccionada.');
    }
    return formaPago;
  }

  private async validarReferenciasOpcionales(
    dto: CreateMovimientoKardexDto,
  ): Promise<void> {
    if (dto.idSubcuenta) {
      const existe = await this.subcuentaRepository.findOne({
        where: { id: dto.idSubcuenta },
      });
      if (!existe) {
        throw new NotFoundException('No existe la subcuenta seleccionada.');
      }
    }
    if (dto.idDestinoGasto) {
      const existe = await this.destinoGastoRepository.findOne({
        where: { id: dto.idDestinoGasto },
      });
      if (!existe) {
        throw new NotFoundException(
          'No existe el destino del gasto seleccionado.',
        );
      }
    }
    if (dto.idCobrador) {
      const existe = await this.personaRepository.findOne({
        where: { id: String(dto.idCobrador) },
      });
      if (!existe) {
        throw new NotFoundException('No existe la persona indicada como cobrador.');
      }
    }
    if (dto.idValorizacion) {
      const existe = await this.valorizacionRepository.findOne({
        where: { id: String(dto.idValorizacion) },
      });
      if (!existe) {
        throw new NotFoundException('No existe la valorización indicada.');
      }
    }
  }

  private async siguienteNumeroLinea(
    manager: EntityManager,
    idKardex: string,
  ): Promise<number> {
    const { max } = await manager
      .createQueryBuilder(MovimientoKardex, 'm')
      .select('COALESCE(MAX(m.numeroLinea), 0)', 'max')
      .where('m.idKardex = :id', { id: idKardex })
      .getRawOne<{ max: string }>();
    return Number(max ?? 0) + 1;
  }

  /** Recalcula el saldo corriente de todas las líneas activas de un kardex. */
  private async recalcularKardex(
    manager: EntityManager,
    idKardex: string,
  ): Promise<void> {
    const kardex = await manager.findOne(Kardex, { where: { id: idKardex } });
    if (!kardex) return;

    const movs = await manager.find(MovimientoKardex, {
      where: { idKardex, activo: true },
      order: { numeroLinea: 'ASC', id: 'ASC' },
    });

    // A diferencia de la libreta de bancos, en el kardex el DEBE (anticipo
    // entregado) SUBE el saldo (la deuda del destinatario) y el HABER
    // (pago/descuento) lo BAJA: saldo = saldo_anterior + debe - haber
    // (misma fórmula que el Excel: =G_ant + E - F).
    let running = this.r2(Number(kardex.saldoInicial));
    for (const mov of movs) {
      running = this.r2(running + Number(mov.debe) - Number(mov.haber));
      if (this.r2(Number(mov.saldo)) !== running) {
        await manager.update(MovimientoKardex, mov.id, { saldo: running });
      }
    }

    await manager.update(Kardex, kardex.id, { saldoActual: running });
  }

  /**
   * Crea una línea de kardex directamente, SIN generar ningún movimiento de
   * caja/banco (a diferencia de `crear()`): para asientos puramente
   * contables donde la plata ya se movió por otro lado (ej. FondoRendirService
   * cargando al kardex personal el saldo sin justificar de un fondo a rendir
   * cuentas; ese saldo no es una salida nueva de plata, ya salió cuando se
   * entregó el fondo). Reusable dentro de una transacción ya abierta.
   */
  async crearLineaSinMovimientoDineroEnTransaccion(
    manager: EntityManager,
    kardex: Kardex,
    datos: {
      fecha: string;
      detalle: string;
      facturaRecibo?: string | null;
      idDestinoGasto?: number | null;
      debe: number;
      haber: number;
      usuarioRegistro: string;
      /** Código de lote (ej. venta de lote). */
      lote?: string | null;
      /** En USD, `debe`/`haber` van ya en Bs. y el original en debeUsd/haberUsd. */
      moneda?: MonedaCaja;
      tipoCambio?: number | null;
      debeUsd?: number;
      haberUsd?: number;
    },
  ): Promise<MovimientoKardex> {
    const numeroLinea = await this.siguienteNumeroLinea(manager, kardex.id);
    const mov = await manager.save(
      manager.create(MovimientoKardex, {
        idKardex: kardex.id,
        numeroLinea,
        fecha: datos.fecha,
        facturaRecibo: datos.facturaRecibo ?? null,
        detalle: datos.detalle,
        idDestinoGasto: datos.idDestinoGasto ?? null,
        lote: datos.lote ?? null,
        moneda: datos.moneda ?? 'BS',
        tipoCambio: datos.tipoCambio ?? null,
        debe: this.r2(datos.debe),
        haber: this.r2(datos.haber),
        debeUsd: this.r2(datos.debeUsd ?? 0),
        haberUsd: this.r2(datos.haberUsd ?? 0),
        saldo: 0,
        usuarioRegistro: datos.usuarioRegistro,
      }),
    );
    await this.recalcularKardex(manager, kardex.id);
    return mov;
  }

  /**
   * Da de baja (activo = false) una línea creada con
   * `crearLineaSinMovimientoDineroEnTransaccion` y recalcula el saldo del
   * kardex. Solo para asientos sin movimiento de dinero (ej. revertir la
   * liquidación de una venta de lote).
   */
  async desactivarLineaSinMovimientoDineroEnTransaccion(
    manager: EntityManager,
    idMovimiento: string,
    usuario: string,
  ): Promise<void> {
    const mov = await manager.findOne(MovimientoKardex, {
      where: { id: idMovimiento },
    });
    if (!mov || !mov.activo) return;
    await manager.update(MovimientoKardex, mov.id, {
      activo: false,
      usuarioUltimaModificacion: usuario,
    });
    await this.recalcularKardex(manager, mov.idKardex);
  }

  // ------------------------------------------------------------------ CRUD
  async guardar(
    dto: CreateMovimientoKardexDto,
    user: Usuario,
  ): Promise<MovimientoKardex> {
    return dto.id ? this.actualizar(dto, user) : this.crear(dto, user);
  }

  private async crear(
    dto: CreateMovimientoKardexDto,
    user: Usuario,
  ): Promise<MovimientoKardex> {
    const kardex = await this.obtenerKardexAbierto(dto.idKardex);
    await this.kardexActividadService.validarActivo(kardex);
    await this.validarReferenciasOpcionales(dto);
    const formaPago = await this.resolverFormaPagoOpcional(dto.idFormaPago);
    const importes = this.importes(dto);
    const { moneda } = importes;
    const cuentaBancaria = await this.resolverCuentaBancariaOpcional(
      dto.idCuentaBancaria,
    );
    // Con cuenta bancaria (medio bancario) el movimiento solo afecta la
    // libreta de bancos; sin ella (efectivo) solo afecta la caja de flujo.
    // Ambas reciben el monto en la moneda del movimiento.
    let cajaEmpresa: Caja | null = null;
    if (cuentaBancaria) {
      validarMonedaCuenta(cuentaBancaria, moneda);
      await this.libretaBancoService.obtenerCuentaAperturada(cuentaBancaria.id);
      if (!formaPago) {
        throw new BadRequestException(
          'idCuentaBancaria requiere indicar también idFormaPago.',
        );
      }
    } else {
      cajaEmpresa = await this.movimientoCajaService.obtenerCajaAperturada(
        ID_CAJA_EMPRESA,
        moneda,
      );
    }
    const beneficiario = this.datosBeneficiarioKardex(kardex);
    const monto = this.r2(Number(dto.monto));

    return this.dataSource.transaction(async (manager) => {
      const numeroLinea = await this.siguienteNumeroLinea(manager, kardex.id);

      const mov = await manager.save(
        manager.create(MovimientoKardex, {
          idKardex: kardex.id,
          numeroLinea,
          fecha: dto.fecha,
          nroComprobante: dto.nroComprobante?.trim() || null,
          facturaRecibo: dto.facturaRecibo?.trim() || null,
          idCuentaBancaria: cuentaBancaria?.id ?? null,
          detalle: dto.detalle.trim(),
          lote: dto.lote?.trim() || null,
          idSubcuenta: dto.idSubcuenta ?? null,
          idFormaPago: dto.idFormaPago ?? null,
          idDestinoGasto: dto.idDestinoGasto ?? null,
          idCobrador: dto.idCobrador ? String(dto.idCobrador) : null,
          idValorizacion: dto.idValorizacion ? String(dto.idValorizacion) : null,
          ...importes,
          saldo: 0,
          usuarioRegistro: user.usuario,
        }),
      );

      await this.recalcularKardex(manager, kardex.id);

      if (!cuentaBancaria) {
        // Efectivo: solo afecta la caja de flujo. DEBE (anticipo entregado,
        // plata que sale) -> EGRESO; HABER (pago/descuento, salda deuda,
        // valor recuperado) -> INGRESO.
        await this.movimientoCajaService.crearMovimientoEnTransaccion(
          manager,
          cajaEmpresa!,
          {
            moneda,
            fecha: dto.fecha,
            nroComprobante: dto.nroComprobante?.trim() || null,
            facturaRecibo: dto.facturaRecibo?.trim() || null,
            idFormaPago: dto.idFormaPago ?? null,
            idPersona: beneficiario.idPersona,
            entregaFondosA: beneficiario.entregaFondosA,
            concepto: dto.detalle.trim(),
            idDestinoGasto: dto.idDestinoGasto ?? null,
            idMovimientoKardex: mov.id,
            ingreso: dto.tipo === 'HABER' ? monto : 0,
            egreso: dto.tipo === 'DEBE' ? monto : 0,
          },
          user,
        );
      } else {
        // Medio bancario: solo afecta la libreta de bancos (misma dirección
        // que tendría en caja: DEBE=sale, HABER=entra), no la caja.
        await this.libretaBancoService.crearMovimientoEnTransaccion(
          manager,
          cuentaBancaria,
          {
            fecha: dto.fecha,
            nroTransaccion: dto.nroComprobante?.trim() || null,
            tipoTransaccion: formaPago?.nombre ?? 'EFECTIVO',
            facturaRecibo: dto.facturaRecibo?.trim() || null,
            idPersona: beneficiario.idPersona,
            nombresApellidos: beneficiario.entregaFondosA,
            concepto: dto.detalle.trim(),
            idDestinoGasto: dto.idDestinoGasto ?? null,
            idMovimientoKardex: mov.id,
            debe: dto.tipo === 'DEBE' ? monto : 0,
            haber: dto.tipo === 'HABER' ? monto : 0,
          },
          user,
        );
      }

      return manager.findOne(MovimientoKardex, {
        where: { id: mov.id },
        relations: RELACIONES,
      });
    });
  }

  /**
   * No sincroniza el movimiento de caja generado en `crear()` (igual que un
   * recibo ya PROCESADO tampoco se puede corregir automáticamente): si hace
   * falta corregir el monto/tipo, se ajusta también a mano el movimiento de
   * caja correspondiente (`MovimientoCaja.idMovimientoKardex`).
   */
  private async actualizar(
    dto: CreateMovimientoKardexDto,
    user: Usuario,
  ): Promise<MovimientoKardex> {
    const mov = await this.movimientoRepository.findOne({
      where: { id: String(dto.id) },
    });
    if (!mov) {
      throw new NotFoundException('No se encontró el movimiento solicitado.');
    }
    if (mov.idKardex !== dto.idKardex) {
      throw new BadRequestException(
        'No se puede cambiar el movimiento de kardex.',
      );
    }

    const kardex = await this.obtenerKardexAbierto(dto.idKardex);
    await this.validarReferenciasOpcionales(dto);
    const importes = this.importes(dto);
    const cuentaBancaria = await this.resolverCuentaBancariaOpcional(
      dto.idCuentaBancaria,
    );
    if (cuentaBancaria) {
      validarMonedaCuenta(cuentaBancaria, importes.moneda);
    }

    return this.dataSource.transaction(async (manager) => {
      await manager.update(MovimientoKardex, mov.id, {
        fecha: dto.fecha,
        nroComprobante: dto.nroComprobante?.trim() || null,
        facturaRecibo: dto.facturaRecibo?.trim() || null,
        idCuentaBancaria: cuentaBancaria?.id ?? null,
        detalle: dto.detalle.trim(),
        lote: dto.lote?.trim() || null,
        idSubcuenta: dto.idSubcuenta ?? null,
        idFormaPago: dto.idFormaPago ?? null,
        idDestinoGasto: dto.idDestinoGasto ?? null,
        idCobrador: dto.idCobrador ? String(dto.idCobrador) : null,
        idValorizacion: dto.idValorizacion ? String(dto.idValorizacion) : null,
        ...importes,
        usuarioUltimaModificacion: user.usuario,
      });

      await this.recalcularKardex(manager, kardex.id);

      return manager.findOne(MovimientoKardex, {
        where: { id: mov.id },
        relations: RELACIONES,
      });
    });
  }

  async cambiarEstado(
    id: string,
    activo: boolean,
    user: Usuario,
  ): Promise<MovimientoKardex> {
    const mov = await this.movimientoRepository.findOne({ where: { id } });
    if (!mov) {
      throw new NotFoundException('No se encontró el movimiento solicitado.');
    }
    await this.obtenerKardexAbierto(mov.idKardex);

    return this.dataSource.transaction(async (manager) => {
      await manager.update(MovimientoKardex, mov.id, {
        activo,
        usuarioUltimaModificacion: user.usuario,
      });
      await this.recalcularKardex(manager, mov.idKardex);
      return manager.findOne(MovimientoKardex, {
        where: { id: mov.id },
        relations: RELACIONES,
      });
    });
  }

  async listar(idKardex: string) {
    const kardex = await this.kardexRepository.findOne({
      where: { id: idKardex },
    });
    if (!kardex) {
      throw new NotFoundException('No se encontró el kardex.');
    }

    // Bandeja liviana: solo lo que muestran la tabla del kardex, el
    // formulario de edición (destino del gasto y cuenta los resuelve por id
    // contra sus catálogos) y el Excel. Nada de valorización, cuenta
    // bancaria ni movimientos de caja por cada línea.
    const movimientos = await this.movimientoRepository.find({
      where: { idKardex },
      relations: { subcuenta: true, formaPago: true, cobrador: true },
      order: { numeroLinea: 'ASC', id: 'ASC' },
    });

    return { kardex, movimientos };
  }

  /**
   * Líneas del kardex para el Excel: como `listar()`, pero con lo que el
   * reporte necesita además (quién aprobó el recibo, banco del
   * pago y lote de la venta).
   */
  async listarParaExcel(idKardex: string) {
    return await this.movimientoRepository.find({
      where: { idKardex },
      relations: {
        formaPago: true,
        cobrador: true,
        cuentaBancaria: { entidadFinanciera: true },
        recibo: { ventaLote: true },
      },
      order: { numeroLinea: 'ASC', id: 'ASC' },
    });
  }

  /**
   * Bandeja paginada de las líneas de un kardex: la última línea primero.
   * `listar()` (completo y en orden ascendente) queda para el Excel.
   */
  async listarPaginado(filtro: FiltroMovimientoKardexDto) {
    const { idKardex, page = 1, limit = 10 } = filtro;
    const kardex = await this.kardexRepository.findOne({
      where: { id: idKardex },
    });
    if (!kardex) {
      throw new NotFoundException('No se encontró el kardex.');
    }

    const [data, total] = await this.movimientoRepository.findAndCount({
      where: { idKardex },
      relations: { subcuenta: true, formaPago: true, cobrador: true },
      order: { numeroLinea: 'DESC', id: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      kardex,
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
