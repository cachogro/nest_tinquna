import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';

import { Usuario } from 'src/security/entities/usuario.entity';
import { RecepcionMineral } from 'src/cluster/comercio-interno/entities/recepcion-mineral/recepcion-mineral.entity';
import { ValorizacionMineral } from 'src/cluster/comercio-interno/entities/valorizacion/valorizacion-mineral.entity';
import { PersonaCi } from 'src/cluster/comercio-interno/entities/persona-ci.entity';
import { ActorProductivoMinero } from 'src/cluster/parametricas/entities/actor-productivo-minero.entity';
import { Cliente } from 'src/cluster/parametricas/entities/cliente.entity';
import { FormaPago } from 'src/cluster/parametricas/entities/forma-pago.entity';
import { DestinoGasto } from 'src/cluster/parametricas/entities/destino-gasto.entity';
import { CuentaBancaria } from 'src/cluster/parametricas/entities/cuenta-bancaria.entity';
import { Caja } from 'src/cluster/parametricas/entities/caja.entity';
import { aplicarOrden } from 'src/common/utils/query-orden.util';
import { Kardex } from '../entities/kardex.entity';
import { MovimientoKardex } from '../entities/movimiento-kardex.entity';
import { MonedaCaja } from '../entities/periodo-caja.entity';
import { Recibo, TipoRecibo, SerieRecibo } from '../entities/recibo.entity';
import { resolverPersonaAutorizo } from '../persona-autorizo.util';
import { ReciboDetalle } from '../entities/recibo-detalle.entity';
import { CreateReciboDto } from '../dto/recibo/create-recibo.dto';
import { ProcesarReciboDto } from '../dto/recibo/procesar-recibo.dto';
import { ReciboDetalleDto } from '../dto/recibo/recibo-detalle.dto';
import { FiltrosReciboDto } from '../dto/recibo/filtros-recibo.dto';

/** Filtros comunes de la bandeja de recibos y de su reporte Excel. */
type FiltrosReciboBase = Pick<
  FiltrosReciboDto,
  'tipo' | 'idPersona' | 'estado' | 'fechaDesde' | 'fechaHasta' | 'busqueda'
>;
import { ReciboPaginadoDto } from '../dto/recibo/recibo-paginado.dto';
import { VentaLote } from '../entities/venta-lote.entity';
import { VentaLoteService } from './venta-lote.service';
import { MovimientoCajaService } from './movimiento-caja.service';
import { LibretaBancoService } from './libreta-banco.service';
import { KardexActividadService } from './kardex-actividad.service';
import { aBolivianos, resolverTipoCambio, validarMonedaCuenta } from '../moneda.util';

// La caja de flujo (Caja id=1, "CAJA PRINCIPAL") es el registro maestro de
// la empresa: todo recibo, además de postear en los kardex de sus detalles,
// se refleja acá por el TOTAL, en la moneda del recibo (BS o USD). El
// kardex lleva su saldo en Bs.: un recibo en USD postea ahí el equivalente
// en Bs. (con su tipo de cambio) y deja el original en debeUsd/haberUsd.
const ID_CAJA_EMPRESA = 1;

// Estado de valorización que habilita el recibo de pago del saldo.
const ESTADO_VALORIZACION_VALORIZADO = 3;

// Formas de pago que implican un medio bancario: exigen cuenta bancaria +
// N° de comprobante ya en la cabecera del recibo (aunque quede BORRADOR),
// aunque el movimiento en libreta_banco recién se postea al procesar.
const FORMAS_PAGO_BANCARIAS = ['QR', 'TRANSFERENCIA', 'CHEQUE', 'DEPOSITO'];

const RELACIONES = {
  persona: true,
  actorProductivoMinero: true,
  cliente: true,
  formaPago: true,
  cuentaBancaria: { entidadFinanciera: true },
  movimientosCaja: { destinoGasto: true },
  movimientosBanco: true,
  detalles: {
    persona: true,
    actorProductivoMinero: true,
    cliente: true,
    destinoGasto: true,
  },
} as const;

@Injectable()
export class ReciboService {
  constructor(
    @InjectRepository(Recibo, 'ci')
    private readonly reciboRepository: Repository<Recibo>,

    @InjectRepository(ReciboDetalle, 'ci')
    private readonly detalleRepository: Repository<ReciboDetalle>,

    @InjectRepository(Kardex, 'ci')
    private readonly kardexRepository: Repository<Kardex>,

    @InjectRepository(PersonaCi, 'ci')
    private readonly personaRepository: Repository<PersonaCi>,

    @InjectRepository(RecepcionMineral, 'ci')
    private readonly recepcionRepository: Repository<RecepcionMineral>,

    @InjectRepository(ValorizacionMineral, 'ci')
    private readonly valorizacionRepository: Repository<ValorizacionMineral>,

    @InjectRepository(VentaLote, 'ci')
    private readonly ventaLoteRepository: Repository<VentaLote>,

    @InjectRepository(ActorProductivoMinero, 'ci')
    private readonly actorRepository: Repository<ActorProductivoMinero>,

    @InjectRepository(Cliente, 'ci')
    private readonly clienteRepository: Repository<Cliente>,

    @InjectRepository(FormaPago, 'ci')
    private readonly formaPagoRepository: Repository<FormaPago>,

    @InjectRepository(DestinoGasto, 'ci')
    private readonly destinoGastoRepository: Repository<DestinoGasto>,

    @InjectRepository(CuentaBancaria, 'ci')
    private readonly cuentaBancariaRepository: Repository<CuentaBancaria>,

    private readonly movimientoCajaService: MovimientoCajaService,
    private readonly libretaBancoService: LibretaBancoService,
    private readonly kardexActividadService: KardexActividadService,
    private readonly ventaLoteService: VentaLoteService,

    @InjectDataSource('ci')
    private readonly dataSource: DataSource,
  ) {}

  // ------------------------------------------------------------------ helpers
  private r2(n: number): number {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  /**
   * Resuelve la contraparte física del recibo ("Recibí de" / "Entregué a"):
   * UNA de estas cuatro, excluyentes entre sí —
   *   - `idPersona`: valida que exista en persona_ci y usa su nombre (o el
   *     texto manual si vino);
   *   - `idActorProductivoMinero`: valida que exista y usa su nombre (o el
   *     texto manual si vino);
   *   - `idCliente`: valida que exista y usa su nombre (o el texto manual);
   *   - ninguna de las tres: guarda solo el texto libre `nombresApellidos`
   *     (recibo entregado a dos personas, o a alguien no registrado).
   */
  private async resolverBeneficiario(dto: CreateReciboDto): Promise<{
    idPersona: string | null;
    idActorProductivoMinero: string | null;
    idCliente: string | null;
    nombresApellidos: string | null;
  }> {
    const textoManual = dto.nombresApellidos?.trim() || null;

    const contraparteCount = [
      dto.idPersona,
      dto.idActorProductivoMinero,
      dto.idCliente,
    ].filter(Boolean).length;
    if (contraparteCount > 1) {
      throw new BadRequestException(
        'La contraparte del recibo solo puede ser una: persona, actor productivo minero o cliente.',
      );
    }

    if (contraparteCount === 0 && !textoManual) {
      throw new BadRequestException(
        'Debe indicar la contraparte del recibo: idPersona, idActorProductivoMinero, idCliente o nombresApellidos.',
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
        idPersona: null,
        idActorProductivoMinero: actor.id,
        idCliente: null,
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
        idPersona: null,
        idActorProductivoMinero: null,
        idCliente: cliente.id,
        nombresApellidos: textoManual || cliente.nombre.toUpperCase(),
      };
    }

    if (!dto.idPersona) {
      return {
        idPersona: null,
        idActorProductivoMinero: null,
        idCliente: null,
        nombresApellidos: textoManual,
      };
    }

    const persona = await this.personaRepository.findOne({
      where: { id: String(dto.idPersona) },
    });
    if (!persona) {
      throw new NotFoundException('No se encontró la persona indicada.');
    }
    if (!persona.activo) {
      throw new BadRequestException('La persona indicada está inactiva.');
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
      idActorProductivoMinero: null,
      idCliente: null,
      nombresApellidos: textoManual || nombreDerivado || null,
    };
  }

  /**
   * Recibo que respalda el anticipo de una recepción de mineral (el front lo
   * genera desde la recepción y envía `idRecepcionMineral`). Debe ser EGRESO,
   * por el monto exacto del anticipo, y la recepción no puede tener otro
   * recibo vigente (BORRADOR/PROCESADO; uno ANULADO libera la recepción).
   */
  private async validarRecepcionAnticipo(
    dto: CreateReciboDto,
  ): Promise<string | null> {
    if (!dto.idRecepcionMineral) return null;

    if (dto.tipo !== 'EGRESO') {
      throw new BadRequestException(
        'El recibo de un anticipo de recepción debe ser de tipo EGRESO.',
      );
    }
    // El anticipo de la recepción se registra en Bs.
    if ((dto.moneda ?? 'BS') !== 'BS') {
      throw new BadRequestException(
        'El recibo de un anticipo de recepción debe ser en Bs. (moneda BS).',
      );
    }

    const recepcion = await this.recepcionRepository.findOne({
      where: { id: String(dto.idRecepcionMineral) },
    });
    if (!recepcion) {
      throw new NotFoundException(
        'No se encontró la recepción de mineral indicada.',
      );
    }

    const anticipo = this.r2(Number(recepcion.anticipo ?? 0));
    if (!(anticipo > 0)) {
      throw new BadRequestException(
        `La recepción ${recepcion.codigoOperacion} no tiene anticipo.`,
      );
    }
    if (this.r2(Number(dto.montoTotal)) !== anticipo) {
      throw new BadRequestException(
        `El monto del recibo (${this.r2(Number(dto.montoTotal))}) debe ser igual al anticipo de la recepción ${recepcion.codigoOperacion} (${anticipo}).`,
      );
    }

    const vigente = await this.reciboRepository.findOne({
      where: {
        idRecepcionMineral: recepcion.id,
        estado: In(['BORRADOR', 'PROCESADO']),
      },
    });
    if (vigente) {
      throw new ConflictException(
        `La recepción ${recepcion.codigoOperacion} ya tiene el recibo ${vigente.serie}-${vigente.numero} (${vigente.estado}).`,
      );
    }

    return recepcion.id;
  }

  /**
   * Recibo que paga el saldo (Líquido Pagable) de una valorización ya
   * VALORIZADA (el front lo genera al terminar de valorizar y envía
   * `idValorizacionMineral`). Mismas reglas que el anticipo de recepción:
   * EGRESO, en Bs., por el monto exacto y un solo recibo vigente.
   */
  private async validarValorizacionLiquidacion(
    dto: CreateReciboDto,
  ): Promise<string | null> {
    if (!dto.idValorizacionMineral) return null;

    if (dto.idRecepcionMineral) {
      throw new BadRequestException(
        'Un recibo no puede ser a la vez anticipo de recepción y pago de valorización.',
      );
    }
    if (dto.tipo !== 'EGRESO') {
      throw new BadRequestException(
        'El recibo de pago de una valorización debe ser de tipo EGRESO.',
      );
    }
    if ((dto.moneda ?? 'BS') !== 'BS') {
      throw new BadRequestException(
        'El recibo de pago de una valorización debe ser en Bs. (moneda BS).',
      );
    }

    const valorizacion = await this.valorizacionRepository.findOne({
      where: { id: String(dto.idValorizacionMineral) },
      relations: { recepcionMineral: true },
    });
    if (!valorizacion) {
      throw new NotFoundException('No se encontró la valorización indicada.');
    }
    const lote =
      valorizacion.recepcionMineral?.codigoOperacion ?? `#${valorizacion.id}`;

    if (Number(valorizacion.idEstadoValorizacion) !== ESTADO_VALORIZACION_VALORIZADO) {
      throw new BadRequestException(
        `La valorización del lote ${lote} todavía no está VALORIZADA.`,
      );
    }

    const saldo = this.r2(Number(valorizacion.totalValorLiquidoVentaBolivianos ?? 0));
    if (!(saldo > 0)) {
      throw new BadRequestException(
        `La valorización del lote ${lote} no tiene saldo a pagar.`,
      );
    }
    if (this.r2(Number(dto.montoTotal)) !== saldo) {
      throw new BadRequestException(
        `El monto del recibo (${this.r2(Number(dto.montoTotal))}) debe ser igual al líquido pagable de la valorización del lote ${lote} (${saldo}).`,
      );
    }

    const vigente = await this.reciboRepository.findOne({
      where: {
        idValorizacionMineral: valorizacion.id,
        estado: In(['BORRADOR', 'PROCESADO']),
      },
    });
    if (vigente) {
      throw new ConflictException(
        `La valorización del lote ${lote} ya tiene el recibo ${vigente.serie}-${vigente.numero} (${vigente.estado}).`,
      );
    }

    return valorizacion.id;
  }

  /**
   * Recibo que cobra un anticipo o pago de una venta de lote (el front lo
   * genera desde la venta y envía `idVentaLote`). Debe ser INGRESO, con el
   * cliente de la venta como contraparte, y no puede pasarse de lo que falta
   * cobrar si la venta ya está liquidada. Admite varios recibos por venta.
   */
  private async validarVentaLote(dto: CreateReciboDto): Promise<string | null> {
    if (!dto.idVentaLote) return null;

    if (dto.idRecepcionMineral || dto.idValorizacionMineral) {
      throw new BadRequestException(
        'Un recibo de venta de lote no puede estar vinculado también a una recepción o valorización.',
      );
    }
    if (dto.tipo !== 'INGRESO') {
      throw new BadRequestException(
        'El cobro de una venta de lote debe ser un recibo de INGRESO.',
      );
    }

    const venta = await this.ventaLoteRepository.findOne({
      where: { id: String(dto.idVentaLote) },
      relations: { cliente: true },
    });
    if (!venta || !venta.activo) {
      throw new NotFoundException('No se encontró la venta de lote indicada.');
    }
    const lote = venta.codigoLote ?? `#${venta.id}`;
    if (venta.estado === 'ANULADA') {
      throw new BadRequestException(`La venta del lote ${lote} está anulada.`);
    }
    if (String(dto.idCliente ?? '') !== String(venta.idCliente)) {
      throw new BadRequestException(
        `El recibo de la venta del lote ${lote} debe ser a nombre del cliente comprador.`,
      );
    }

    // El tope por lote solo aplica a exportación: en comercio interno el
    // dinero va a la cuenta corriente del cliente y paga los lotes que se
    // vayan liquidando, así que puede superar lo que falta de este lote.
    const cobraPorLote = venta.cliente?.modalidadVenta === 'EXPORTACION';
    if (cobraPorLote && venta.estado === 'LIQUIDADA' && venta.montoVentaBolivianos != null) {
      const moneda: MonedaCaja = dto.moneda ?? 'BS';
      const montoBs = aBolivianos(
        Number(dto.montoTotal),
        moneda,
        resolverTipoCambio(moneda, dto.tipoCambio),
      );
      const totales = (await this.ventaLoteService.totalesCobro([venta.id])).get(venta.id);
      const yaCobrado =
        (totales?.cobradoBolivianos ?? 0) + (totales?.pendienteBolivianos ?? 0);
      const falta = this.r2(Number(venta.montoVentaBolivianos) - yaCobrado);
      if (montoBs - falta > 0.01) {
        throw new BadRequestException(
          `El recibo (Bs ${montoBs}) supera lo que falta cobrar de la venta del lote ${lote} (Bs ${Math.max(falta, 0)}).`,
        );
      }
    }

    return venta.id;
  }

  private serieDeTipo(tipo: TipoRecibo): SerieRecibo {
    return tipo === 'INGRESO' ? 'R' : 'C';
  }

  private formatearNroComprobante(serie: SerieRecibo, numero: number): string {
    return `REC:${serie}-${String(numero).padStart(4, '0')}`;
  }

  private async siguienteNumero(
    manager: EntityManager,
    serie: SerieRecibo,
  ): Promise<number> {
    const { max } = await manager
      .createQueryBuilder(Recibo, 'r')
      .select('COALESCE(MAX(r.numero), 0)', 'max')
      .where('r.serie = :serie', { serie })
      .getRawOne<{ max: string }>();
    return Number(max ?? 0) + 1;
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

  /** Mismo algoritmo que MovimientoKardexService.recalcularKardex. */
  private async recalcularKardex(
    manager: EntityManager,
    idKardex: string,
  ): Promise<void> {
    const kardex = await manager.findOne(Kardex, { where: { id: idKardex } });
    if (!kardex) return;

    const movs = await manager.find(MovimientoKardex, {
      where: { idKardex, activo: true },
      order: { fecha: 'ASC', id: 'ASC' },
    });

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
   * Busca el kardex abierto de una persona sin importar si es PERSONAL
   * (personal interno) o ASOCIADO (relacionada a otro actor, o suelta):
   * comparten la FK `idPersona`, el recibo no necesita saber la
   * subclasificación, solo a qué persona va.
   */
  private async obtenerKardexAbiertoPersonal(
    idPersona: string,
  ): Promise<Kardex> {
    const kardex = await this.kardexRepository.findOne({
      where: [
        { tipo: 'PERSONAL', idPersona, estado: 'ABIERTO' },
        { tipo: 'ASOCIADO', idPersona, estado: 'ABIERTO' },
      ],
      relations: { persona: true },
    });
    if (!kardex) {
      throw new NotFoundException(
        `La persona ${idPersona} no tiene un kardex abierto. Abrilo primero.`,
      );
    }
    await this.kardexActividadService.validarActivo(kardex);
    return kardex;
  }

  private async obtenerKardexAbiertoActor(
    idActorProductivoMinero: string,
  ): Promise<Kardex> {
    const kardex = await this.kardexRepository.findOne({
      where: {
        tipo: 'ACTOR',
        idActorProductivoMinero,
        estado: 'ABIERTO',
      },
      relations: { actorProductivoMinero: true },
    });
    if (!kardex) {
      throw new NotFoundException(
        `El actor productivo minero ${idActorProductivoMinero} no tiene un kardex abierto. Abrilo primero.`,
      );
    }
    await this.kardexActividadService.validarActivo(kardex);
    return kardex;
  }

  private async obtenerKardexAbiertoCliente(
    idCliente: string,
  ): Promise<Kardex> {
    const kardex = await this.kardexRepository.findOne({
      where: {
        tipo: 'CLIENTE',
        idCliente,
        estado: 'ABIERTO',
      },
      relations: { cliente: true },
    });
    if (!kardex) {
      throw new NotFoundException(
        `El cliente ${idCliente} no tiene un kardex abierto. Abrilo primero.`,
      );
    }
    await this.kardexActividadService.validarActivo(kardex);
    return kardex;
  }

  /**
   * Nombre/id de persona a guardar en el movimiento de caja (y de banco) de
   * esta línea: el titular real del kardex afectado (persona, actor o
   * cliente), no la contraparte genérica de la cabecera del recibo. Si la
   * línea es EFECTIVO sin titular propio (no afecta ningún kardex), se usa
   * la contraparte de la cabecera como respaldo.
   */
  private datosBeneficiarioLinea(
    kardex: Kardex | undefined,
    recibo: Recibo,
  ): { idPersona: string | null; nombresApellidos: string | null } {
    if (
      (kardex?.tipo === 'PERSONAL' || kardex?.tipo === 'ASOCIADO') &&
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
      return { idPersona: kardex.persona.id, nombresApellidos: nombre || null };
    }
    if (kardex?.tipo === 'ACTOR' && kardex.actorProductivoMinero) {
      return {
        idPersona: null,
        nombresApellidos:
          kardex.actorProductivoMinero.nombre?.toUpperCase() ?? null,
      };
    }
    if (kardex?.tipo === 'CLIENTE' && kardex.cliente) {
      return {
        idPersona: null,
        nombresApellidos: kardex.cliente.nombre?.toUpperCase() ?? null,
      };
    }
    return {
      idPersona: recibo.idPersona ?? null,
      nombresApellidos: recibo.nombresApellidos ?? null,
    };
  }

  private async resolverIdDestinoGasto(
    idDestinoGasto?: number,
  ): Promise<number | null> {
    if (!idDestinoGasto) {
      return null;
    }
    const destinoGasto = await this.destinoGastoRepository.findOne({
      where: { id: idDestinoGasto },
    });
    if (!destinoGasto) {
      throw new NotFoundException(
        'No existe el destino del gasto seleccionado.',
      );
    }
    return destinoGasto.id;
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

  /**
   * Si la forma de pago es un medio bancario (QR, Transferencia, Cheque,
   * Depósito), exige que la cabecera ya traiga `idCuentaBancaria` y
   * `nroComprobante` — se guardan igual (aunque el recibo quede BORRADOR),
   * el movimiento real en libreta_banco recién se postea al procesar.
   */
  private validarDatosBancariosCabecera(
    formaPago: FormaPago | null,
    idCuentaBancaria: number | null | undefined,
    nroComprobante: string | null | undefined,
  ): void {
    // Cuenta bancaria sin forma de pago: no hay de dónde sacar el
    // tipoTransaccion que exige libreta_banco si esta línea llega a postear ahí.
    if (idCuentaBancaria && !formaPago) {
      throw new BadRequestException(
        'idCuentaBancaria requiere indicar también idFormaPago.',
      );
    }
    if (!formaPago || !FORMAS_PAGO_BANCARIAS.includes(formaPago.codigo)) {
      return;
    }
    if (!idCuentaBancaria) {
      throw new BadRequestException(
        `La forma de pago ${formaPago.nombre} requiere indicar la cuenta bancaria (idCuentaBancaria).`,
      );
    }
    if (!nroComprobante?.trim()) {
      throw new BadRequestException(
        `La forma de pago ${formaPago.nombre} requiere el N° de comprobante (nroComprobante).`,
      );
    }
  }

  /**
   * Solo valida que la cuenta exista y esté activa (uso puramente
   * informativo del recibo: no requiere que esté aperturada). La validación
   * de "aperturada" se hace aparte, y solo si de verdad va a postear un
   * movimiento en libreta_banco (ver `validarYPrepararDetalles`).
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

  /**
   * Valida solo la cabecera: no requiere `detalles` (puede ser un borrador).
   * Si la forma de pago es bancaria, exige cuenta bancaria + N° de
   * comprobante ya acá (se guardan en el recibo aunque quede BORRADOR).
   */
  private async validarCabecera(dto: CreateReciboDto): Promise<{
    idFormaPago: number | null;
    nombreFormaPago: string | null;
    cuentaBancaria: CuentaBancaria | null;
  }> {
    const formaPago = await this.resolverFormaPagoOpcional(dto.idFormaPago);
    const cuentaBancaria = await this.resolverCuentaBancariaOpcional(
      dto.idCuentaBancaria,
    );

    this.validarDatosBancariosCabecera(
      formaPago,
      cuentaBancaria?.id,
      dto.nroComprobante,
    );

    return {
      idFormaPago: formaPago?.id ?? null,
      nombreFormaPago: formaPago?.nombre ?? null,
      cuentaBancaria,
    };
  }

  private validarDetalle(detalle: ReciboDetalleDto): void {
    if (detalle.destino === 'PERSONAL' && !detalle.idPersona) {
      throw new BadRequestException(
        'Una línea con destino PERSONAL requiere idPersona.',
      );
    }
    if (detalle.destino === 'ACTOR' && !detalle.idActorProductivoMinero) {
      throw new BadRequestException(
        'Una línea con destino ACTOR requiere idActorProductivoMinero.',
      );
    }
    if (detalle.destino === 'CLIENTE' && !detalle.idCliente) {
      throw new BadRequestException(
        'Una línea con destino CLIENTE requiere idCliente.',
      );
    }
    if (
      detalle.destino === 'EFECTIVO' &&
      [
        detalle.idPersona,
        detalle.idActorProductivoMinero,
        detalle.idCliente,
      ].filter(Boolean).length > 1
    ) {
      throw new BadRequestException(
        'Una línea EFECTIVO solo puede traer uno: idPersona, idActorProductivoMinero o idCliente.',
      );
    }
  }

  /**
   * Valida y resuelve todo lo necesario para PROCESAR un recibo (sea en el
   * mismo paso de creación, o al procesar un borrador): la suma de
   * `detalles` contra el `montoTotal`, cada línea de detalle (incluido su
   * propio `idDestinoGasto`), la caja de la empresa (aperturada), el kardex
   * ABIERTO de cada línea PERSONAL/ACTOR y, si hay `cuentaBancaria` y al
   * menos una línea EFECTIVO (o sea, si de verdad va a postear en
   * libreta_banco), que esa cuenta esté aperturada. Falla rápido, antes de
   * abrir la transacción.
   */
  private async validarYPrepararDetalles(
    montoTotal: number,
    detalles: ReciboDetalleDto[] | undefined,
    cuentaBancaria: CuentaBancaria | null,
    moneda: MonedaCaja,
  ): Promise<{
    cajaEmpresa: Caja | null;
    kardexPorDetalle: Map<number, Kardex>;
    destinoGastoPorDetalle: Map<number, number | null>;
  }> {
    if (!detalles || detalles.length === 0) {
      throw new BadRequestException(
        'El recibo debe tener al menos una línea de detalle para procesarse.',
      );
    }

    const sumaDetalles = this.r2(
      detalles.reduce((s, d) => s + Number(d.monto), 0),
    );
    if (sumaDetalles !== this.r2(Number(montoTotal))) {
      throw new BadRequestException(
        `La suma de los detalles (${sumaDetalles}) no coincide con el monto total del recibo (${montoTotal}).`,
      );
    }

    for (const detalle of detalles) {
      this.validarDetalle(detalle);
    }

    // Con cuenta bancaria (medio bancario) el recibo solo afecta la libreta
    // de bancos; sin ella (efectivo) solo afecta la caja de flujo. Ambas en
    // la moneda del recibo.
    let cajaEmpresa: Caja | null = null;
    if (cuentaBancaria) {
      validarMonedaCuenta(cuentaBancaria, moneda);
      await this.libretaBancoService.obtenerCuentaAperturada(cuentaBancaria.id);
    } else {
      cajaEmpresa = await this.movimientoCajaService.obtenerCajaAperturada(
        ID_CAJA_EMPRESA,
        moneda,
      );
    }

    const kardexPorDetalle = new Map<number, Kardex>();
    const destinoGastoPorDetalle = new Map<number, number | null>();
    for (let i = 0; i < detalles.length; i++) {
      const detalle = detalles[i];
      if (detalle.destino === 'PERSONAL') {
        kardexPorDetalle.set(
          i,
          await this.obtenerKardexAbiertoPersonal(String(detalle.idPersona)),
        );
      } else if (detalle.destino === 'ACTOR') {
        kardexPorDetalle.set(
          i,
          await this.obtenerKardexAbiertoActor(
            String(detalle.idActorProductivoMinero),
          ),
        );
      } else if (detalle.destino === 'CLIENTE') {
        kardexPorDetalle.set(
          i,
          await this.obtenerKardexAbiertoCliente(String(detalle.idCliente)),
        );
      } else if (detalle.destino === 'EFECTIVO' && detalle.idPersona) {
        // EFECTIVO con idPersona: plata entregada directamente a alguien que
        // sí tiene kardex, se registra como anticipo (DEBE) en su kardex.
        kardexPorDetalle.set(
          i,
          await this.obtenerKardexAbiertoPersonal(String(detalle.idPersona)),
        );
      } else if (
        detalle.destino === 'EFECTIVO' &&
        detalle.idActorProductivoMinero
      ) {
        kardexPorDetalle.set(
          i,
          await this.obtenerKardexAbiertoActor(
            String(detalle.idActorProductivoMinero),
          ),
        );
      } else if (detalle.destino === 'EFECTIVO' && detalle.idCliente) {
        kardexPorDetalle.set(
          i,
          await this.obtenerKardexAbiertoCliente(String(detalle.idCliente)),
        );
      }
      destinoGastoPorDetalle.set(
        i,
        await this.resolverIdDestinoGasto(detalle.idDestinoGasto),
      );
    }

    return { cajaEmpresa, kardexPorDetalle, destinoGastoPorDetalle };
  }

  /**
   * Postea la línea de kardex de cada detalle (si corresponde) y el
   * movimiento de caja de flujo de esa misma línea, cada uno con su propio
   * `idDestinoGasto`. Las líneas PERSONAL/ACTOR postean HABER en su kardex
   * (saldan una deuda existente) y SIEMPRE un INGRESO en caja (valor
   * recuperado por la empresa, sea cual sea el tipo del recibo). Las líneas
   * EFECTIVO postean en caja según el tipo del recibo (INGRESO si el
   * recibo es INGRESO, EGRESO si es EGRESO — es la porción que
   * efectivamente entra o sale) y, si además traen `idPersona`/
   * `idActorProductivoMinero` de alguien con kardex abierto, también un
   * DEBE en ese kardex (anticipo nuevo: sube su deuda, a diferencia de
   * PERSONAL/ACTOR que la baja). Si el recibo tiene `cuentaBancaria` (se
   * pagó por un medio bancario), la línea EFECTIVO también postea en la
   * libreta de bancos, en la misma dirección que en caja. Reusado tanto por
   * `generar` (un solo paso) como por `procesar` (segundo paso de un
   * borrador).
   */
  private async procesarDetalles(
    manager: EntityManager,
    recibo: Recibo,
    detalles: ReciboDetalleDto[],
    idFormaPago: number | null,
    nombreFormaPago: string | null,
    cuentaBancaria: CuentaBancaria | null,
    cajaEmpresa: Caja | null,
    kardexPorDetalle: Map<number, Kardex>,
    destinoGastoPorDetalle: Map<number, number | null>,
    user: Usuario,
  ): Promise<void> {
    const nroComprobanteInterno = this.formatearNroComprobante(
      recibo.serie,
      recibo.numero,
    );

    for (let i = 0; i < detalles.length; i++) {
      const detalleDto = detalles[i];
      const monto = this.r2(Number(detalleDto.monto));
      const idDestinoGasto = destinoGastoPorDetalle.get(i) ?? null;
      let idMovimientoKardex: string | null = null;

      const esEfectivo = detalleDto.destino === 'EFECTIVO';

      const kardex = kardexPorDetalle.get(i);
      if (kardex) {
        // EFECTIVO con persona/actor conocido = anticipo nuevo (DEBE, sube
        // deuda); PERSONAL/ACTOR = pago que salda deuda existente (HABER).
        // El kardex va en Bs.: en USD se convierte con el tipo de cambio
        // del recibo y el original queda en debeUsd/haberUsd.
        const montoBs = aBolivianos(monto, recibo.moneda, recibo.tipoCambio ?? null);
        const montoUsd = recibo.moneda === 'USD' ? monto : 0;
        const numeroLinea = await this.siguienteNumeroLinea(manager, kardex.id);
        const mov = await manager.save(
          manager.create(MovimientoKardex, {
            idKardex: kardex.id,
            numeroLinea,
            fecha: recibo.fecha,
            nroComprobante: recibo.nroComprobante ?? null,
            facturaRecibo: nroComprobanteInterno,
            idCuentaBancaria: cuentaBancaria?.id ?? null,
            detalle: recibo.concepto,
            lote: detalleDto.lote?.trim() || null,
            idFormaPago,
            idDestinoGasto,
            idCobrador: recibo.idPersona ?? null,
            idRecibo: recibo.id,
            moneda: recibo.moneda,
            tipoCambio: recibo.tipoCambio ?? null,
            debe: esEfectivo ? montoBs : 0,
            haber: esEfectivo ? 0 : montoBs,
            debeUsd: esEfectivo ? montoUsd : 0,
            haberUsd: esEfectivo ? 0 : montoUsd,
            saldo: 0,
            usuarioRegistro: user.usuario,
          }),
        );
        await this.recalcularKardex(manager, kardex.id);
        idMovimientoKardex = mov.id;
      }

      await manager.save(
        manager.create(ReciboDetalle, {
          idRecibo: recibo.id,
          destino: detalleDto.destino,
          idPersona:
            detalleDto.destino !== 'ACTOR' &&
            detalleDto.destino !== 'CLIENTE' &&
            detalleDto.idPersona
              ? String(detalleDto.idPersona)
              : null,
          idActorProductivoMinero:
            detalleDto.destino !== 'PERSONAL' &&
            detalleDto.destino !== 'CLIENTE' &&
            detalleDto.idActorProductivoMinero
              ? String(detalleDto.idActorProductivoMinero)
              : null,
          idCliente:
            detalleDto.destino !== 'PERSONAL' &&
            detalleDto.destino !== 'ACTOR' &&
            detalleDto.idCliente
              ? String(detalleDto.idCliente)
              : null,
          monto,
          idDestinoGasto,
          idMovimientoKardex,
          usuarioRegistro: user.usuario,
        }),
      );

      // Movimiento en la caja de flujo (Caja id=1, "CAJA PRINCIPAL") de esta
      // misma línea. PERSONAL/ACTOR -> siempre INGRESO (valor recuperado por
      // la empresa al saldar esa deuda, sea cual sea el tipo del recibo).
      // EFECTIVO -> sigue el tipo del recibo: INGRESO si el recibo es
      // INGRESO (plata que efectivamente entra), EGRESO si el recibo es
      // EGRESO (plata que efectivamente sale).
      const entraACaja = esEfectivo ? recibo.tipo === 'INGRESO' : true;
      // El beneficiario del movimiento es el titular real de esta línea
      // (persona o actor del kardex afectado), no la contraparte genérica
      // de la cabecera del recibo.
      const beneficiarioLinea = this.datosBeneficiarioLinea(kardex, recibo);
      if (!cuentaBancaria) {
        // Efectivo: solo afecta la caja de flujo.
        await this.movimientoCajaService.crearMovimientoEnTransaccion(
          manager,
          cajaEmpresa!,
          {
            moneda: recibo.moneda,
            fecha: recibo.fecha,
            nroComprobante: recibo.nroComprobante ?? null,
            facturaRecibo: nroComprobanteInterno,
            idFormaPago,
            idPersona: beneficiarioLinea.idPersona,
            entregaFondosA: beneficiarioLinea.nombresApellidos,
            concepto: recibo.concepto,
            idDestinoGasto,
            idRecibo: recibo.id,
            ingreso: entraACaja ? monto : 0,
            egreso: entraACaja ? 0 : monto,
          },
          user,
        );
      } else {
        // Medio bancario: solo afecta la libreta de bancos (misma dirección
        // que tendría en caja: HABER si entra, DEBE si sale), no la caja.
        await this.libretaBancoService.crearMovimientoEnTransaccion(
          manager,
          cuentaBancaria,
          {
            fecha: recibo.fecha,
            nroTransaccion: recibo.nroComprobante ?? null,
            tipoTransaccion: nombreFormaPago ?? 'EFECTIVO',
            facturaRecibo: nroComprobanteInterno,
            idPersona: beneficiarioLinea.idPersona,
            nombresApellidos: beneficiarioLinea.nombresApellidos,
            concepto: recibo.concepto,
            idDestinoGasto,
            idRecibo: recibo.id,
            debe: entraACaja ? 0 : monto,
            haber: entraACaja ? monto : 0,
          },
          user,
        );
      }
    }
  }

  // ------------------------------------------------------------------ CRUD
  /**
   * Sin `detalles`: crea el recibo como BORRADOR (solo cabecera).
   * Con `detalles`: crea y procesa el recibo en el mismo paso (PROCESADO).
   */
  async generar(dto: CreateReciboDto, user: Usuario): Promise<Recibo> {
    const persistir = await this.prepararGeneracion(dto, user);
    return this.dataSource.transaction(persistir);
  }

  /**
   * Igual que `generar`, pero dentro de una transacción ya abierta por quien
   * llama (préstamos, boletas de pago): el recibo y lo que registre el
   * llamador se confirman o revierten juntos.
   */
  async generarEnTransaccion(
    manager: EntityManager,
    dto: CreateReciboDto,
    user: Usuario,
  ): Promise<Recibo> {
    const persistir = await this.prepararGeneracion(dto, user);
    return persistir(manager);
  }

  /**
   * Valida todo lo del recibo antes de abrir la transacción y devuelve la
   * función que lo persiste (cabecera + procesamiento de sus detalles).
   */
  private async prepararGeneracion(
    dto: CreateReciboDto,
    user: Usuario,
  ): Promise<(manager: EntityManager) => Promise<Recibo>> {
    const { idFormaPago, nombreFormaPago, cuentaBancaria } =
      await this.validarCabecera(dto);
    const beneficiario = await this.resolverBeneficiario(dto);
    // Quien autorizó: distinto de la contraparte física (`idPersona`).
    const personaAutorizo = await resolverPersonaAutorizo(
      this.personaRepository,
      dto.idPersonaAutorizo,
      'el recibo',
    );
    const idRecepcionMineral = await this.validarRecepcionAnticipo(dto);
    const idValorizacionMineral =
      await this.validarValorizacionLiquidacion(dto);
    const idVentaLote = await this.validarVentaLote(dto);
    const serie = this.serieDeTipo(dto.tipo);
    const moneda: MonedaCaja = dto.moneda ?? 'BS';
    const tipoCambio = resolverTipoCambio(moneda, dto.tipoCambio);
    // La cuenta se guarda ya en el borrador: tiene que ser de la moneda del
    // recibo desde el principio.
    if (cuentaBancaria) {
      validarMonedaCuenta(cuentaBancaria, moneda);
    }

    const tieneDetalles = !!dto.detalles && dto.detalles.length > 0;
    const previo = tieneDetalles
      ? await this.validarYPrepararDetalles(
          dto.montoTotal,
          dto.detalles,
          cuentaBancaria,
          moneda,
        )
      : null;

    return async (manager: EntityManager) => {
      const numero = await this.siguienteNumero(manager, serie);

      const recibo = await manager.save(
        manager.create(Recibo, {
          tipo: dto.tipo,
          serie,
          numero,
          fecha: dto.fecha,
          fechaHoraGeneracion: new Date(),
          montoTotal: this.r2(Number(dto.montoTotal)),
          moneda,
          tipoCambio,
          concepto: dto.concepto.trim(),
          idFormaPago,
          idCuentaBancaria: cuentaBancaria?.id ?? null,
          nroComprobante: dto.nroComprobante?.trim() || null,
          idPersona: beneficiario.idPersona,
          idActorProductivoMinero: beneficiario.idActorProductivoMinero,
          idCliente: beneficiario.idCliente,
          nombresApellidos: beneficiario.nombresApellidos,
          personaAutorizo,
          idRecepcionMineral,
          idValorizacionMineral,
          idVentaLote,
          estado: tieneDetalles ? 'PROCESADO' : 'BORRADOR',
          usuarioRegistro: user.usuario,
        }),
      );

      if (tieneDetalles) {
        await this.procesarDetalles(
          manager,
          recibo,
          dto.detalles,
          idFormaPago,
          nombreFormaPago,
          cuentaBancaria,
          previo.cajaEmpresa,
          previo.kardexPorDetalle,
          previo.destinoGastoPorDetalle,
          user,
        );
      }

      return manager.findOne(Recibo, {
        where: { id: recibo.id },
        relations: RELACIONES,
      });
    };
  }

  /**
   * Segundo paso de un recibo BORRADOR: postea las líneas de kardex y los
   * movimientos de caja de flujo, y lo deja PROCESADO (terminal). Los
   * campos de pago bancario son opcionales: si no se envían, se conserva lo
   * que ya tenía el recibo desde que se creó como borrador.
   */
  async procesar(
    id: string,
    dto: ProcesarReciboDto,
    user: Usuario,
  ): Promise<Recibo> {
    const recibo = await this.reciboRepository.findOne({ where: { id } });
    if (!recibo) {
      throw new NotFoundException('No se encontró el recibo solicitado.');
    }
    if (recibo.estado !== 'BORRADOR') {
      throw new BadRequestException(
        `El recibo no se puede procesar: está ${recibo.estado === 'PROCESADO' ? 'ya procesado' : 'anulado'}.`,
      );
    }

    const formaPago = dto.idFormaPago
      ? await this.resolverFormaPagoOpcional(dto.idFormaPago)
      : recibo.idFormaPago
        ? await this.resolverFormaPagoOpcional(recibo.idFormaPago)
        : null;
    const idFormaPago = formaPago?.id ?? null;
    const cuentaBancaria = await this.resolverCuentaBancariaOpcional(
      dto.idCuentaBancaria ?? recibo.idCuentaBancaria ?? undefined,
    );
    const nroComprobante =
      dto.nroComprobante?.trim() || recibo.nroComprobante || null;

    this.validarDatosBancariosCabecera(
      formaPago,
      cuentaBancaria?.id,
      nroComprobante,
    );

    // La moneda y el tipo de cambio se fijan al crear el borrador.
    const previo = await this.validarYPrepararDetalles(
      recibo.montoTotal,
      dto.detalles,
      cuentaBancaria,
      recibo.moneda,
    );

    return this.dataSource.transaction(async (manager) => {
      await manager.update(Recibo, recibo.id, {
        idFormaPago,
        idCuentaBancaria: cuentaBancaria?.id ?? null,
        nroComprobante,
        estado: 'PROCESADO',
        usuarioUltimaModificacion: user.usuario,
      });

      const reciboActualizado: Recibo = Object.assign(recibo, {
        idFormaPago,
        idCuentaBancaria: cuentaBancaria?.id ?? null,
        nroComprobante,
      });

      await this.procesarDetalles(
        manager,
        reciboActualizado,
        dto.detalles,
        idFormaPago,
        formaPago?.nombre ?? null,
        cuentaBancaria,
        previo.cajaEmpresa,
        previo.kardexPorDetalle,
        previo.destinoGastoPorDetalle,
        user,
      );

      return manager.findOne(Recibo, {
        where: { id: recibo.id },
        relations: RELACIONES,
      });
    });
  }

  /**
   * Anula un recibo BORRADOR (nunca uno PROCESADO: no hay nada que revertir
   * en kardex/caja porque un borrador todavía no generó movimientos).
   */
  async anular(id: string, user: Usuario): Promise<Recibo> {
    const recibo = await this.reciboRepository.findOne({ where: { id } });
    if (!recibo) {
      throw new NotFoundException('No se encontró el recibo solicitado.');
    }
    if (recibo.estado !== 'BORRADOR') {
      throw new BadRequestException(
        recibo.estado === 'PROCESADO'
          ? 'No se puede anular un recibo ya procesado.'
          : 'El recibo ya está anulado.',
      );
    }

    await this.reciboRepository.update(recibo.id, {
      estado: 'ANULADO',
      usuarioUltimaModificacion: user.usuario,
    });

    return this.reciboRepository.findOne({
      where: { id: recibo.id },
      relations: RELACIONES,
    });
  }

  async listar(filtro: FiltrosReciboDto): Promise<ReciboPaginadoDto> {
    const {
      page = 1,
      limit = 10,
      tipo,
      idPersona,
      estado,
      fechaDesde,
      fechaHasta,
      busqueda,
      orderBy = 'fecha',
      orderDirection = 'DESC',
    } = filtro;

    const qb = this.consultaFiltrada({
      tipo,
      idPersona,
      estado,
      fechaDesde,
      fechaHasta,
      busqueda,
    });

    aplicarOrden(
      qb,
      {
        id: 'r.id',
        numero: 'r.numero',
        fecha: 'r.fecha',
        montoTotal: 'r.montoTotal',
      },
      orderBy,
      orderDirection,
    );
    qb.addOrderBy('r.id', orderDirection);

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

  /**
   * Todos los recibos que cumplen los filtros (sin paginar), en orden
   * cronológico y por número, con lo necesario para el reporte Excel.
   */
  async listarParaReporte(filtro: FiltrosReciboBase): Promise<Recibo[]> {
    return this.consultaFiltrada(filtro)
      .leftJoinAndSelect('r.actorProductivoMinero', 'actor')
      .leftJoinAndSelect('r.cliente', 'cliente')
      .leftJoinAndSelect('r.cuentaBancaria', 'cuentaBancaria')
      .leftJoinAndSelect('cuentaBancaria.entidadFinanciera', 'entidadFinanciera')
      .orderBy('r.fecha', 'ASC')
      .addOrderBy('r.serie', 'ASC')
      .addOrderBy('r.numero', 'ASC')
      .getMany();
  }

  /** Consulta base de recibos con los filtros comunes de la bandeja y del reporte. */
  private consultaFiltrada(filtro: FiltrosReciboBase) {
    const { tipo, idPersona, estado, fechaDesde, fechaHasta, busqueda } = filtro;
    const qb = this.reciboRepository
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.persona', 'persona')
      .leftJoinAndSelect('r.formaPago', 'formaPago')
      // usuarioRegistro tiene select:false en la entidad base Auditoria (se
      // oculta por defecto en todo el sistema); la bandeja de recibos sí
      // necesita mostrar quién generó cada uno.
      .addSelect('r.usuarioRegistro');

    if (tipo) {
      qb.andWhere('r.tipo = :tipo', { tipo });
    }
    if (idPersona) {
      qb.andWhere('r.idPersona = :idPersona', { idPersona });
    }
    if (estado) {
      qb.andWhere('r.estado = :estado', { estado });
    }
    if (fechaDesde) {
      qb.andWhere('r.fecha >= :desde', { desde: fechaDesde });
    }
    if (fechaHasta) {
      qb.andWhere('r.fecha <= :hasta', { hasta: fechaHasta });
    }
    if (busqueda) {
      qb.andWhere(
        `(
          r.concepto ILIKE :busqueda
          OR r.nombresApellidos ILIKE :busqueda
          OR persona.nombres ILIKE :busqueda
          OR persona.apellidoPaterno ILIKE :busqueda
          OR persona.apellidoMaterno ILIKE :busqueda
          OR (r.serie || '-' || LPAD(r.numero::text, 4, '0')) ILIKE :busqueda
        )`,
        { busqueda: `%${busqueda}%` },
      );
    }
    return qb;
  }

  async buscarPorId(id: string): Promise<Recibo> {
    const recibo = await this.reciboRepository.findOne({
      where: { id },
      // La recepción (con su muestrero) se imprime en el PDF del recibo de
      // anticipo: ver recibo-recepcion.util.ts.
      relations: {
        ...RELACIONES,
        recepcionMineral: { personalInterno: true },
      },
    });
    if (!recibo) {
      throw new NotFoundException('No se encontró el recibo solicitado.');
    }
    // usuarioRegistro tiene select:false en Auditoria (oculto por defecto);
    // `findOne` con `relations` no admite reincorporarlo sin listar a mano
    // el resto de columnas, así que se trae aparte con una consulta chica.
    const { usuarioRegistro } = await this.reciboRepository
      .createQueryBuilder('r')
      .select('r.usuarioRegistro', 'usuarioRegistro')
      .where('r.id = :id', { id })
      .getRawOne<{ usuarioRegistro: string | null }>();
    recibo.usuarioRegistro = usuarioRegistro ?? undefined;
    return recibo;
  }
}
