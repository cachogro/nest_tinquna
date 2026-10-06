import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';

import { Usuario } from 'src/security/entities/usuario.entity';
import { CuentaBancaria } from 'src/cluster/parametricas/entities/cuenta-bancaria.entity';
import { DestinoGasto } from 'src/cluster/parametricas/entities/destino-gasto.entity';
import { PersonaCi } from 'src/cluster/comercio-interno/entities/persona-ci.entity';
import { LibretaBanco } from '../entities/libreta-banco.entity';
import { PeriodoBanco } from '../entities/periodo-banco.entity';
import { CreateLibretaBancoDto } from '../dto/libreta-banco/create-libreta-banco.dto';
import { FiltroLibretaBancoDto } from '../dto/libreta-banco/filtro-libreta-banco.dto';
import { CerrarPeriodoBancoDto } from '../dto/libreta-banco/cerrar-periodo-banco.dto';
import { CerrarGestionBancoDto } from '../dto/libreta-banco/cerrar-gestion-banco.dto';
import { ActorProductivoMinero } from 'src/cluster/parametricas/entities/actor-productivo-minero.entity';
import { Cliente } from 'src/cluster/parametricas/entities/cliente.entity';
import { FormaPago } from 'src/cluster/parametricas/entities/forma-pago.entity';
import { Kardex } from '../entities/kardex.entity';
import { MovimientoKardex } from '../entities/movimiento-kardex.entity';
import { aBolivianos, monedaDeCuenta, resolverTipoCambio } from '../moneda.util';
import {
  buscarKardexAbiertoContraparte,
  contraparteDeKardex,
  recalcularSaldoKardex,
  siguienteNumeroLineaKardex,
} from '../kardex-posteo.util';
import { KardexActividadService } from './kardex-actividad.service';

/** Relaciones que se devuelven al crear/editar/cambiar estado un movimiento. */
const RELACIONES_MOVIMIENTO = {
  periodoBanco: true,
  persona: true,
  actorProductivoMinero: true,
  cliente: true,
  destinoGasto: true,
} as const;

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

    @InjectRepository(DestinoGasto, 'ci')
    private readonly destinoGastoRepository: Repository<DestinoGasto>,

    @InjectRepository(ActorProductivoMinero, 'ci')
    private readonly actorRepository: Repository<ActorProductivoMinero>,

    @InjectRepository(Cliente, 'ci')
    private readonly clienteRepository: Repository<Cliente>,

    private readonly kardexActividadService: KardexActividadService,

    @InjectDataSource('ci')
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Resuelve el beneficiario / contraparte del movimiento (mismo criterio
   * que la contraparte de un recibo). Solo UNA de:
   *   - `idPersona`: valida que exista en persona_ci y usa su nombre;
   *   - `idActorProductivoMinero`: valida que exista y esté activo;
   *   - `idCliente`: valida que exista y esté activo;
   *   - ninguna: guarda solo el texto libre `nombresApellidos`.
   * Con vínculo, `nombresApellidos` toma el texto manual si vino o, si no,
   * el nombre del vinculado (es lo que se imprime y sale en el Excel).
   */
  private async resolverBeneficiario(dto: CreateLibretaBancoDto): Promise<{
    idPersona: string | null;
    idActorProductivoMinero: string | null;
    idCliente: string | null;
    nombresApellidos: string | null;
  }> {
    const textoManual = dto.nombresApellidos?.trim() || null;
    const sinVinculo = {
      idPersona: null,
      idActorProductivoMinero: null,
      idCliente: null,
    };

    const vinculos = [
      dto.idPersona,
      dto.idActorProductivoMinero,
      dto.idCliente,
    ].filter(Boolean).length;
    if (vinculos > 1) {
      throw new BadRequestException(
        'El beneficiario del movimiento solo puede ser uno: persona, actor productivo minero o cliente.',
      );
    }

    if (dto.idActorProductivoMinero) {
      const actor = await this.actorRepository.findOne({
        where: { id: String(dto.idActorProductivoMinero) },
      });
      if (!actor) {
        throw new NotFoundException(
          'No se encontró el actor productivo minero indicado.',
        );
      }
      if (!actor.activo) {
        throw new BadRequestException(
          'El actor productivo minero indicado está inactivo.',
        );
      }
      return {
        ...sinVinculo,
        idActorProductivoMinero: actor.id,
        nombresApellidos: textoManual || actor.nombre.toUpperCase(),
      };
    }

    if (dto.idCliente) {
      const cliente = await this.clienteRepository.findOne({
        where: { id: String(dto.idCliente) },
      });
      if (!cliente) {
        throw new NotFoundException('No se encontró el cliente indicado.');
      }
      if (!cliente.activo) {
        throw new BadRequestException('El cliente indicado está inactivo.');
      }
      return {
        ...sinVinculo,
        idCliente: cliente.id,
        nombresApellidos: textoManual || cliente.nombre.toUpperCase(),
      };
    }

    if (!dto.idPersona) {
      return { ...sinVinculo, nombresApellidos: textoManual };
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
      ...sinVinculo,
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

  /**
   * Importes de la línea de kardex: el kardex lleva su saldo en Bs.; si la
   * cuenta es en USD se convierte con `tipoCambio` (obligatorio en ese caso)
   * y el original queda en debeUsd/haberUsd. Misma dirección que el banco:
   * DEBE (sale plata, anticipo) sube la deuda; HABER (entra plata, pago) la baja.
   */
  private importesKardex(
    cuenta: CuentaBancaria,
    debe: number,
    haber: number,
    tipoCambio?: number | string | null,
  ) {
    const moneda = monedaDeCuenta(cuenta);
    const tc = resolverTipoCambio(moneda, tipoCambio);
    return {
      moneda,
      tipoCambio: tc,
      debe: aBolivianos(debe, moneda, tc),
      haber: aBolivianos(haber, moneda, tc),
      debeUsd: moneda === 'USD' ? debe : 0,
      haberUsd: moneda === 'USD' ? haber : 0,
    };
  }

  /**
   * `id_forma_pago` de la línea de kardex a partir del texto libre
   * `tipoTransaccion` de la libreta (QR, TRANSFERENCIA...), buscado por
   * código o nombre en parametrica.forma_pago. Null si no hay coincidencia
   * (ej. RETIRO): la línea se guarda igual, sin forma de pago.
   */
  private async resolverIdFormaPago(tipoTransaccion: string): Promise<number | null> {
    const texto = tipoTransaccion.trim().toUpperCase();
    if (!texto) {
      return null;
    }
    const formaPago = await this.dataSource.manager
      .createQueryBuilder(FormaPago, 'fp')
      .where('UPPER(fp.codigo) = :texto OR UPPER(fp.nombre) = :texto', { texto })
      .getOne();
    return formaPago?.id ?? null;
  }

  /** Los movimientos generados por un recibo o un traspaso se gestionan desde su origen. */
  private validarEditableDesdeLibreta(mov: LibretaBanco): void {
    if (mov.idRecibo) {
      throw new BadRequestException(
        'Este movimiento lo generó un recibo: no se puede modificar desde la libreta de bancos.',
      );
    }
    if (mov.idTraspaso) {
      throw new BadRequestException(
        'Este movimiento lo generó un traspaso: modificalo o desactivalo desde el traspaso.',
      );
    }
  }

  /** Línea de kardex enlazada al movimiento (si la tiene), validando que su kardex siga abierto. */
  private async lineaKardexEditable(
    mov: LibretaBanco,
  ): Promise<(MovimientoKardex & { kardex: Kardex }) | null> {
    if (!mov.idMovimientoKardex) {
      return null;
    }
    const linea = await this.dataSource.manager.findOne(MovimientoKardex, {
      where: { id: mov.idMovimientoKardex },
      relations: { kardex: true },
    });
    if (!linea?.kardex) {
      return null;
    }
    if (linea.kardex.estado === 'CERRADO') {
      throw new BadRequestException(
        `El movimiento está cargado en el kardex ${linea.kardex.codigo}, que ya está cerrado: no puede modificarse.`,
      );
    }
    return linea as MovimientoKardex & { kardex: Kardex };
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

  /** Solo valida que el destino exista (mismo criterio que MovimientoCajaService). */
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
        order: { folio: 'ASC', id: 'ASC' },
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

  /**
   * Valida que la cuenta esté aperturada (tenga `fechaSaldoInicial` seteada)
   * antes de permitirle registrar movimientos.
   */
  async obtenerCuentaAperturada(id: number): Promise<CuentaBancaria> {
    const cuenta = await this.obtenerCuentaActiva(id);
    if (!cuenta.fechaSaldoInicial) {
      throw new BadRequestException(
        `La cuenta bancaria "${cuenta.numeroCuenta}" todavía no fue aperturada. Cargá el saldo y la fecha de apertura antes de registrar movimientos.`,
      );
    }
    return cuenta;
  }

  /**
   * Core de la creación de un movimiento, reusable dentro de una transacción
   * ya abierta por otro servicio (ej. ReciboService, que necesita que su
   * posteo a libreta_banco sea atómico junto con el resto del recibo).
   */
  async crearMovimientoEnTransaccion(
    manager: EntityManager,
    cuenta: CuentaBancaria,
    datos: {
      fecha: string;
      nroTransaccion?: string | null;
      tipoTransaccion: string;
      facturaRecibo?: string | null;
      idPersona?: string | null;
      idActorProductivoMinero?: string | null;
      idCliente?: string | null;
      nombresApellidos?: string | null;
      concepto: string;
      idRecibo?: string | null;
      idMovimientoKardex?: string | null;
      idTraspaso?: string | null;
      idDestinoGasto?: number | null;
      /** Bs. por 1 USD, si la cuenta es en USD y quien llama lo conoce. */
      tipoCambio?: number | null;
      debe: number;
      haber: number;
    },
    user: Usuario,
  ): Promise<LibretaBanco> {
    const [gestion, mes] = this.gestionMesDeFecha(datos.fecha);
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
        fecha: datos.fecha,
        nroTransaccion: datos.nroTransaccion ?? null,
        tipoTransaccion: datos.tipoTransaccion,
        facturaRecibo: datos.facturaRecibo ?? null,
        idPersona: datos.idPersona ?? null,
        idActorProductivoMinero: datos.idActorProductivoMinero ?? null,
        idCliente: datos.idCliente ?? null,
        nombresApellidos: datos.nombresApellidos ?? null,
        concepto: datos.concepto,
        idRecibo: datos.idRecibo ?? null,
        idMovimientoKardex: datos.idMovimientoKardex ?? null,
        idTraspaso: datos.idTraspaso ?? null,
        idDestinoGasto: datos.idDestinoGasto ?? null,
        tipoCambio: datos.tipoCambio ?? null,
        debe: this.r2(datos.debe),
        haber: this.r2(datos.haber),
        saldo: 0,
        usuarioRegistro: user.usuario,
      }),
    );

    await this.recalcularCuenta(manager, cuenta.id);
    return mov;
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
    const { debe, haber } = this.debeHaber(dto);
    // Cuenta en USD: el tipo de cambio es obligatorio aunque no haya kardex
    // (queda en el movimiento como referencia del equivalente en Bs.).
    const tipoCambio = resolverTipoCambio(monedaDeCuenta(cuenta), dto.tipoCambio);
    const beneficiario = await this.resolverBeneficiario(dto);
    const idDestinoGasto = await this.resolverDestinoGasto(dto.idDestinoGasto);
    // Con persona/actor/cliente: también afecta su kardex abierto (falla si
    // no tiene uno). Sin contraparte vinculada: solo se registra en la libreta.
    const kardex = await buscarKardexAbiertoContraparte(
      this.dataSource.manager,
      beneficiario,
    );
    if (kardex) {
      await this.kardexActividadService.validarActivo(kardex);
    }
    const importesKardex = kardex
      ? this.importesKardex(cuenta, debe, haber, tipoCambio)
      : null;
    const idFormaPago = kardex ? await this.resolverIdFormaPago(dto.tipoTransaccion) : null;
    const nroTransaccion = dto.nroTransaccion?.trim() || null;
    const facturaRecibo = dto.facturaRecibo?.trim() || null;
    const concepto = dto.concepto.trim();

    return this.dataSource.transaction(async (manager) => {
      let idMovimientoKardex: string | null = null;
      if (kardex && importesKardex) {
        const linea = await manager.save(
          manager.create(MovimientoKardex, {
            idKardex: kardex.id,
            numeroLinea: await siguienteNumeroLineaKardex(manager, kardex.id),
            fecha: dto.fecha,
            nroComprobante: nroTransaccion,
            facturaRecibo,
            idCuentaBancaria: cuenta.id,
            idFormaPago,
            detalle: concepto,
            idDestinoGasto,
            ...importesKardex,
            saldo: 0,
            usuarioRegistro: user.usuario,
          }),
        );
        await recalcularSaldoKardex(manager, kardex.id);
        idMovimientoKardex = linea.id;
      }

      const mov = await this.crearMovimientoEnTransaccion(
        manager,
        cuenta,
        {
          fecha: dto.fecha,
          nroTransaccion,
          tipoTransaccion: dto.tipoTransaccion.trim(),
          facturaRecibo,
          idPersona: beneficiario.idPersona,
          idActorProductivoMinero: beneficiario.idActorProductivoMinero,
          idCliente: beneficiario.idCliente,
          nombresApellidos: beneficiario.nombresApellidos,
          concepto,
          idDestinoGasto,
          idMovimientoKardex,
          tipoCambio,
          debe,
          haber,
        },
        user,
      );

      return manager.findOne(LibretaBanco, {
        where: { id: mov.id },
        relations: RELACIONES_MOVIMIENTO,
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
    this.validarEditableDesdeLibreta(mov);
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
    let beneficiario = await this.resolverBeneficiario(dto);
    const idDestinoGasto = await this.resolverDestinoGasto(dto.idDestinoGasto);
    const nroTransaccion = dto.nroTransaccion?.trim() || null;
    const facturaRecibo =
      dto.facturaRecibo !== undefined
        ? dto.facturaRecibo.trim() || null
        : mov.facturaRecibo ?? null;
    const concepto = dto.concepto.trim();

    // Kardex: si el movimiento ya tiene línea, se sincroniza y la contraparte
    // queda fija (es la titular de ese kardex); si no la tiene y ahora se
    // indica persona/actor/cliente, se postea una línea nueva.
    const linea = await this.lineaKardexEditable(mov);
    const indicaContraparte = Boolean(
      beneficiario.idPersona ||
        beneficiario.idActorProductivoMinero ||
        beneficiario.idCliente,
    );
    let kardexNuevo: Kardex | null = null;
    if (linea) {
      const titular = contraparteDeKardex(linea.kardex);
      const cambia =
        indicaContraparte &&
        (String(beneficiario.idPersona ?? '') !== String(titular.idPersona ?? '') ||
          String(beneficiario.idActorProductivoMinero ?? '') !==
            String(titular.idActorProductivoMinero ?? '') ||
          String(beneficiario.idCliente ?? '') !== String(titular.idCliente ?? ''));
      if (cambia) {
        throw new BadRequestException(
          'Este movimiento ya está cargado en el kardex de otra persona/actor/cliente. Para cambiar la contraparte, desactivá el movimiento y registralo de nuevo.',
        );
      }
      beneficiario = {
        ...titular,
        nombresApellidos:
          dto.nombresApellidos?.trim() ||
          beneficiario.nombresApellidos ||
          mov.nombresApellidos ||
          null,
      };
    } else if (indicaContraparte) {
      kardexNuevo = await buscarKardexAbiertoContraparte(
        this.dataSource.manager,
        beneficiario,
      );
      if (kardexNuevo) {
        await this.kardexActividadService.validarActivo(kardexNuevo);
      }
    }
    // En USD el tipo de cambio es obligatorio también al editar; si no llega
    // se conserva el que ya tenía el movimiento (o su línea de kardex).
    const tipoCambio = resolverTipoCambio(
      monedaDeCuenta(cuenta),
      dto.tipoCambio ?? mov.tipoCambio ?? linea?.tipoCambio ?? null,
    );
    const importesKardex =
      linea || kardexNuevo
        ? this.importesKardex(cuenta, debe, haber, tipoCambio)
        : null;
    const idFormaPago =
      linea || kardexNuevo ? await this.resolverIdFormaPago(dto.tipoTransaccion) : null;

    return this.dataSource.transaction(async (manager) => {
      let idMovimientoKardex = mov.idMovimientoKardex ?? null;
      if (linea && importesKardex) {
        await manager.update(MovimientoKardex, linea.id, {
          fecha: dto.fecha,
          nroComprobante: nroTransaccion,
          facturaRecibo,
          idFormaPago,
          detalle: concepto,
          idDestinoGasto,
          ...importesKardex,
          usuarioUltimaModificacion: user.usuario,
        });
        await recalcularSaldoKardex(manager, linea.idKardex);
      } else if (kardexNuevo && importesKardex) {
        const nueva = await manager.save(
          manager.create(MovimientoKardex, {
            idKardex: kardexNuevo.id,
            numeroLinea: await siguienteNumeroLineaKardex(manager, kardexNuevo.id),
            fecha: dto.fecha,
            nroComprobante: nroTransaccion,
            facturaRecibo,
            idCuentaBancaria: cuenta.id,
            idFormaPago,
            detalle: concepto,
            idDestinoGasto,
            ...importesKardex,
            saldo: 0,
            usuarioRegistro: user.usuario,
          }),
        );
        await recalcularSaldoKardex(manager, kardexNuevo.id);
        idMovimientoKardex = nueva.id;
      }

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
        nroTransaccion,
        tipoTransaccion: dto.tipoTransaccion.trim(),
        facturaRecibo,
        idPersona: beneficiario.idPersona,
        idActorProductivoMinero: beneficiario.idActorProductivoMinero,
        idCliente: beneficiario.idCliente,
        nombresApellidos: beneficiario.nombresApellidos,
        concepto,
        idDestinoGasto,
        idMovimientoKardex,
        tipoCambio,
        debe,
        haber,
        usuarioUltimaModificacion: user.usuario,
      });

      await this.recalcularCuenta(manager, cuenta.id);

      return manager.findOne(LibretaBanco, {
        where: { id: mov.id },
        relations: RELACIONES_MOVIMIENTO,
      });
    });
  }

  /**
   * Expone el recálculo de saldos para otros servicios (ej. TraspasoService,
   * que edita `libreta_banco` directamente y necesita recalcular después)
   * dentro de una transacción ya abierta.
   */
  async recalcularSaldosEnTransaccion(
    manager: EntityManager,
    idCuentaBancaria: number,
  ): Promise<void> {
    await this.recalcularCuenta(manager, idCuentaBancaria);
  }

  /**
   * Núcleo de "activar/desactivar un movimiento" (update + recálculo),
   * reusable dentro de una transacción ya abierta por otro servicio (ej.
   * TraspasoService, que necesita activar/desactivar en bloque el movimiento
   * de libreta_banco y el de caja de un mismo traspaso).
   */
  async cambiarEstadoEnTransaccion(
    manager: EntityManager,
    mov: LibretaBanco,
    activo: boolean,
    user: Usuario,
  ): Promise<void> {
    await manager.update(LibretaBanco, mov.id, {
      activo,
      usuarioUltimaModificacion: user.usuario,
    });
    await this.recalcularSaldosEnTransaccion(manager, mov.idCuentaBancaria);
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
    this.validarEditableDesdeLibreta(mov);
    if (mov.periodoBanco.estado === 'CERRADO') {
      throw new BadRequestException(
        'El movimiento pertenece a un período cerrado y no puede modificarse.',
      );
    }
    // Si el movimiento afecta un kardex, su línea se activa/desactiva junto
    // con él para que el saldo del kardex no quede descuadrado.
    const linea = await this.lineaKardexEditable(mov);

    return this.dataSource.transaction(async (manager) => {
      await this.cambiarEstadoEnTransaccion(manager, mov, activo, user);
      if (linea) {
        await manager.update(MovimientoKardex, linea.id, {
          activo,
          usuarioUltimaModificacion: user.usuario,
        });
        await recalcularSaldoKardex(manager, linea.idKardex);
      }
      return manager.findOne(LibretaBanco, {
        where: { id: mov.id },
        relations: RELACIONES_MOVIMIENTO,
      });
    });
  }

  async listar(filtro: FiltroLibretaBancoDto) {
    const cuenta = await this.obtenerCuentaActiva(filtro.idCuentaBancaria);

    // Bandeja liviana: solo lo que muestra la tabla. El período ya viaja en
    // `periodos` (el front cruza por idPeriodoBanco) y el detalle completo
    // del movimiento se pide aparte con GET libreta-banco/detalle/:id.
    const qb = this.libretaRepository
      .createQueryBuilder('l')
      .innerJoin('l.periodoBanco', 'p')
      .leftJoin('l.persona', 'per')
      .addSelect([
        'per.id',
        'per.nombres',
        'per.apellidoPaterno',
        'per.apellidoMaterno',
        'per.numeroDocumento',
      ])
      .leftJoin('l.actorProductivoMinero', 'act')
      .addSelect(['act.id', 'act.nombre'])
      .leftJoin('l.cliente', 'cli')
      .addSelect(['cli.id', 'cli.nombre'])
      // usuarioRegistro tiene select:false en Auditoria; la bandeja muestra
      // quién registró cada movimiento.
      .addSelect('l.usuarioRegistro')
      .where('l.idCuentaBancaria = :id', { id: cuenta.id });

    if (filtro.gestion) {
      qb.andWhere('p.gestion = :g', { g: filtro.gestion });
    }
    if (filtro.mes) {
      qb.andWhere('p.mes = :m', { m: filtro.mes });
    }

    // El folio se reinicia en cada gestión: se ordena primero por período
    // para que, sin filtro de gestión, no se mezclen los años.
    qb.orderBy('p.gestion', 'ASC')
      .addOrderBy('p.mes', 'ASC')
      .addOrderBy('l.folio', 'ASC')
      .addOrderBy('l.id', 'ASC');
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

  /**
   * Detalle completo de un movimiento (visor de la bandeja): cuenta, período,
   * beneficiario, destino del gasto, auditoría y un resumen del origen
   * (recibo, traspaso o línea de kardex) cuando lo tiene.
   */
  async buscarPorId(id: string): Promise<LibretaBanco> {
    const movimiento = await this.libretaRepository
      .createQueryBuilder('l')
      .leftJoinAndSelect('l.cuentaBancaria', 'cuenta')
      .leftJoinAndSelect('cuenta.entidadFinanciera', 'entidad')
      .leftJoinAndSelect('l.periodoBanco', 'p')
      .leftJoinAndSelect('l.persona', 'per')
      .leftJoin('l.actorProductivoMinero', 'act')
      .addSelect(['act.id', 'act.nombre'])
      .leftJoin('l.cliente', 'cli')
      .addSelect(['cli.id', 'cli.nombre'])
      .leftJoinAndSelect('l.destinoGasto', 'dg')
      .leftJoin('l.recibo', 'rec')
      .addSelect(['rec.id', 'rec.serie', 'rec.numero', 'rec.tipo', 'rec.estado'])
      .leftJoin('l.traspaso', 'tr')
      .addSelect(['tr.id', 'tr.tipo', 'tr.concepto'])
      .leftJoin('l.movimientoKardex', 'mk')
      .addSelect(['mk.id', 'mk.numeroLinea'])
      .leftJoin('mk.kardex', 'k')
      .addSelect(['k.id', 'k.numero', 'k.tipo', 'k.gestion'])
      .leftJoin('k.persona', 'kper')
      .addSelect([
        'kper.id',
        'kper.nombres',
        'kper.apellidoPaterno',
        'kper.apellidoMaterno',
      ])
      .leftJoin('k.actorProductivoMinero', 'kact')
      .addSelect(['kact.id', 'kact.nombre'])
      .leftJoin('k.cliente', 'kcli')
      .addSelect(['kcli.id', 'kcli.nombre'])
      // usuarioRegistro y fechaRegistro tienen select:false en Auditoria.
      .addSelect(['l.usuarioRegistro', 'l.fechaRegistro'])
      .where('l.id = :id', { id })
      .getOne();
    if (!movimiento) {
      throw new NotFoundException('No se encontró el movimiento.');
    }
    return movimiento;
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
