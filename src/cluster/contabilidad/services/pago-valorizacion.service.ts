import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';

import { Usuario } from 'src/security/entities/usuario.entity';
import { ValorizacionMineral } from 'src/cluster/comercio-interno/entities/valorizacion/valorizacion-mineral.entity';
import { RecepcionMineral } from 'src/cluster/comercio-interno/entities/recepcion-mineral/recepcion-mineral.entity';
import { PersonaCi } from 'src/cluster/comercio-interno/entities/persona-ci.entity';
import { proveedorDeRecepcion } from 'src/cluster/comercio-interno/recepcion-proveedor.util';
import { FormaPago } from 'src/cluster/parametricas/entities/forma-pago.entity';
import { CuentaBancaria } from 'src/cluster/parametricas/entities/cuenta-bancaria.entity';
import { DestinoGasto } from 'src/cluster/parametricas/entities/destino-gasto.entity';
import { Kardex } from '../entities/kardex.entity';
import { MovimientoKardex } from '../entities/movimiento-kardex.entity';
import { MovimientoCaja } from '../entities/movimiento-caja.entity';
import { LibretaBanco } from '../entities/libreta-banco.entity';
import { Recibo } from '../entities/recibo.entity';
import { PagoValorizacion } from '../entities/pago-valorizacion.entity';
import {
  ConceptoPagoValorizacion,
  PagoValorizacionDetalle,
} from '../entities/pago-valorizacion-detalle.entity';
import {
  CreatePagoValorizacionDto,
  KardexDestinoDto,
} from '../dto/pago-valorizacion/create-pago-valorizacion.dto';
import { resolverPersonaAutorizo } from '../persona-autorizo.util';
import { validarMonedaCuenta } from '../moneda.util';
import { MovimientoCajaService } from './movimiento-caja.service';
import { LibretaBancoService } from './libreta-banco.service';
import { KardexActividadService } from './kardex-actividad.service';

// Caja de flujo de la empresa (Caja id=1, "CAJA PRINCIPAL"), igual que recibos.
const ID_CAJA_EMPRESA = 1;
const ESTADO_VALORIZACION_VALORIZADO = 3;
const FORMAS_PAGO_BANCARIAS = ['QR', 'TRANSFERENCIA', 'CHEQUE', 'DEPOSITO'];
// La valorización y sus anticipos se manejan en Bs.
const MONEDA = 'BS' as const;

/** Línea de kardex (HABER) que va a generar el pago. */
interface LineaKardex {
  concepto: ConceptoPagoValorizacion;
  kardex: Kardex;
  monto: number;
}

const RELACIONES = {
  formaPago: true,
  cuentaBancaria: { entidadFinanciera: true },
  destinoGasto: true,
  detalles: { kardex: { persona: true, actorProductivoMinero: true, cliente: true } },
} as const;

/**
 * Pago del líquido pagable de una valorización: transacción interna, sin
 * recibo (el respaldo es el PDF de la valorización firmado).
 *
 *  - Lo que se paga de verdad (líquido − abonos a kardex) sale de la caja de
 *    flujo o de la libreta bancaria como egreso, y NO toca ningún kardex.
 *  - Lo que el proveedor deja a un kardex se anota ahí como HABER.
 *  - Los anticipos que la valorización ya descontó del líquido (el de la
 *    recepción y los "otros anticipos") también se anotan como HABER: al
 *    descontárselos, el proveedor ya pagó esa deuda.
 */
@Injectable()
export class PagoValorizacionService {
  constructor(
    @InjectRepository(PagoValorizacion, 'ci')
    private readonly pagoRepository: Repository<PagoValorizacion>,

    @InjectRepository(ValorizacionMineral, 'ci')
    private readonly valorizacionRepository: Repository<ValorizacionMineral>,

    @InjectRepository(Kardex, 'ci')
    private readonly kardexRepository: Repository<Kardex>,

    @InjectRepository(PersonaCi, 'ci')
    private readonly personaRepository: Repository<PersonaCi>,

    private readonly movimientoCajaService: MovimientoCajaService,
    private readonly libretaBancoService: LibretaBancoService,
    private readonly kardexActividadService: KardexActividadService,

    @InjectDataSource('ci')
    private readonly dataSource: DataSource,
  ) {}

  // ------------------------------------------------------------------ helpers
  private r2(n: number): number {
    return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  }

  private nombreKardex(kardex: Kardex): string {
    if (kardex.actorProductivoMinero) return kardex.actorProductivoMinero.nombre;
    if (kardex.cliente) return kardex.cliente.nombre;
    const p = kardex.persona;
    return [p?.nombres, p?.apellidoPaterno, p?.apellidoMaterno]
      .filter(Boolean)
      .join(' ')
      .trim();
  }

  private resumenKardex(kardex: Kardex) {
    return {
      idKardex: kardex.id,
      codigo: kardex.codigo,
      tipo: kardex.tipo,
      nombre: this.nombreKardex(kardex),
      idPersona: kardex.idPersona ?? null,
      idActorProductivoMinero: kardex.idActorProductivoMinero ?? null,
      idCliente: kardex.idCliente ?? null,
    };
  }

  private async obtenerValorizacion(id: string): Promise<ValorizacionMineral> {
    const valorizacion = await this.valorizacionRepository.findOne({
      where: { id: String(id) },
      relations: { recepcionMineral: { persona: true } },
    });
    if (!valorizacion) {
      throw new NotFoundException('No se encontró la valorización indicada.');
    }
    return valorizacion;
  }

  private codigoDe(valorizacion: ValorizacionMineral): string {
    return (
      valorizacion.recepcionMineral?.codigoOperacion ?? `#${valorizacion.id}`
    );
  }

  /** Kardex ABIERTO del dueño indicado (persona, actor o cliente). */
  private async kardexAbiertoDe(
    destino: KardexDestinoDto,
    paraQue: string,
  ): Promise<Kardex> {
    const relations = {
      persona: true,
      actorProductivoMinero: true,
      cliente: true,
    };
    let kardex: Kardex | null = null;
    let quien = '';

    if (destino.destino === 'PERSONAL') {
      if (!destino.idPersona) {
        throw new BadRequestException(`Falta la persona del kardex (${paraQue}).`);
      }
      quien = `La persona ${destino.idPersona}`;
      kardex = await this.kardexRepository.findOne({
        where: [
          { tipo: 'PERSONAL', idPersona: String(destino.idPersona), estado: 'ABIERTO' },
          { tipo: 'ASOCIADO', idPersona: String(destino.idPersona), estado: 'ABIERTO' },
        ],
        relations,
      });
    } else if (destino.destino === 'ACTOR') {
      if (!destino.idActorProductivoMinero) {
        throw new BadRequestException(`Falta el actor productivo del kardex (${paraQue}).`);
      }
      quien = `El actor productivo ${destino.idActorProductivoMinero}`;
      kardex = await this.kardexRepository.findOne({
        where: {
          tipo: 'ACTOR',
          idActorProductivoMinero: String(destino.idActorProductivoMinero),
          estado: 'ABIERTO',
        },
        relations,
      });
    } else {
      if (!destino.idCliente) {
        throw new BadRequestException(`Falta el cliente del kardex (${paraQue}).`);
      }
      quien = `El cliente ${destino.idCliente}`;
      kardex = await this.kardexRepository.findOne({
        where: {
          tipo: 'CLIENTE',
          idCliente: String(destino.idCliente),
          estado: 'ABIERTO',
        },
        relations,
      });
    }

    if (!kardex) {
      throw new NotFoundException(
        `${quien} no tiene un kardex abierto (${paraQue}). Abrilo primero.`,
      );
    }
    return kardex;
  }

  /**
   * Kardex donde el recibo de anticipo de la recepción cargó la deuda (DEBE),
   * con el monto de cada uno. Si ese kardex ya se cerró, se usa el que esté
   * abierto del mismo dueño (el saldo se arrastró ahí). Vacío si el anticipo
   * no tiene recibo PROCESADO o si se entregó sin afectar ningún kardex.
   */
  private async kardexDelAnticipo(
    recepcion: RecepcionMineral | undefined,
  ): Promise<{ kardex: Kardex; monto: number }[]> {
    if (!recepcion) return [];
    const recibo = await this.dataSource.manager.findOne(Recibo, {
      where: { idRecepcionMineral: recepcion.id, estado: 'PROCESADO' },
    });
    if (!recibo) return [];

    const movimientos = await this.dataSource.manager.find(MovimientoKardex, {
      where: { idRecibo: recibo.id, activo: true },
    });
    const porKardex = new Map<string, number>();
    for (const mov of movimientos) {
      const debe = this.r2(Number(mov.debe));
      if (debe > 0) {
        porKardex.set(mov.idKardex, this.r2((porKardex.get(mov.idKardex) ?? 0) + debe));
      }
    }

    const resultado: { kardex: Kardex; monto: number }[] = [];
    for (const [idKardex, monto] of porKardex) {
      const original = await this.kardexRepository.findOne({
        where: { id: idKardex },
        relations: { persona: true, actorProductivoMinero: true, cliente: true },
      });
      if (!original) continue;
      const kardex =
        original.estado === 'ABIERTO'
          ? original
          : await this.kardexAbiertoDe(
              original.tipo === 'ACTOR'
                ? { destino: 'ACTOR', idActorProductivoMinero: original.idActorProductivoMinero ?? undefined }
                : original.tipo === 'CLIENTE'
                  ? { destino: 'CLIENTE', idCliente: original.idCliente ?? undefined }
                  : { destino: 'PERSONAL', idPersona: original.idPersona ?? undefined },
              `anticipo de la recepción ${recepcion.codigoOperacion}, cargado en el kardex ${original.codigo} ya cerrado`,
            );
      resultado.push({ kardex, monto });
    }
    return resultado;
  }

  /**
   * Montos del pago. Si el líquido es negativo (los anticipos superan lo que
   * vale el mineral) no hay nada que pagar y los anticipos solo se cancelan
   * hasta donde alcanzó el mineral: primero se recorta "otros anticipos" y
   * después el anticipo de la recepción.
   */
  private montos(valorizacion: ValorizacionMineral) {
    const liquido = this.r2(Number(valorizacion.totalValorLiquidoVentaBolivianos ?? 0));
    let anticipo = this.r2(Number(valorizacion.anticipo ?? 0));
    let otrosAnticipos = this.r2(Number(valorizacion.otrosAnticipo ?? 0));
    if (liquido < 0) {
      let faltante = this.r2(-liquido);
      const recorteOtros = Math.min(otrosAnticipos, faltante);
      otrosAnticipos = this.r2(otrosAnticipos - recorteOtros);
      faltante = this.r2(faltante - recorteOtros);
      anticipo = this.r2(Math.max(anticipo - faltante, 0));
    }
    return { liquido, aPagar: Math.max(liquido, 0), anticipo, otrosAnticipos };
  }

  private async pagoVigente(idValorizacion: string): Promise<PagoValorizacion | null> {
    return this.pagoRepository.findOne({
      where: { idValorizacionMineral: String(idValorizacion), estado: 'REGISTRADO' },
      relations: RELACIONES,
    });
  }

  // ------------------------------------------------------------------ preparar
  /**
   * Datos para armar el pago en el front: montos de la valorización, en qué
   * kardex se va a cancelar el anticipo de la recepción y el pago vigente
   * (si ya se registró).
   */
  async preparar(idValorizacion: string) {
    const valorizacion = await this.obtenerValorizacion(idValorizacion);
    const recepcion = valorizacion.recepcionMineral;
    const proveedor = proveedorDeRecepcion(recepcion);
    const montos = this.montos(valorizacion);

    const delAnticipo =
      montos.anticipo > 0 ? await this.kardexDelAnticipo(recepcion) : [];
    let porCancelar = montos.anticipo;
    const anticipoEnKardex = delAnticipo.map(({ kardex, monto }) => {
      const cancela = this.r2(Math.min(monto, porCancelar));
      porCancelar = this.r2(porCancelar - cancela);
      return { ...this.resumenKardex(kardex), monto: cancela };
    });

    return {
      idValorizacionMineral: valorizacion.id,
      codigoOperacion: this.codigoDe(valorizacion),
      valorizada: valorizacion.idEstadoValorizacion === ESTADO_VALORIZACION_VALORIZADO,
      proveedor: {
        idPersona: recepcion?.idPersona ?? null,
        idActorProductivoMinero: recepcion?.idActorProductivoMinero ?? null,
        nombre: [proveedor?.nombres, proveedor?.apellidoPaterno, proveedor?.apellidoMaterno]
          .filter(Boolean)
          .join(' ')
          .trim(),
      },
      liquidoPagable: montos.liquido,
      montoAPagar: montos.aPagar,
      anticipo: montos.anticipo,
      otrosAnticipos: montos.otrosAnticipos,
      // HABER automático que cancela el anticipo en cada kardex.
      anticipoEnKardex: anticipoEnKardex.filter((a) => a.monto > 0),
      // Parte del anticipo que no está cargada en ningún kardex (se entregó
      // a un externo, o su recibo no está procesado): no hay nada que cancelar.
      anticipoSinKardex: porCancelar,
      pagoVigente: await this.pagoVigente(valorizacion.id),
    };
  }

  // ------------------------------------------------------------------ registrar
  async registrar(dto: CreatePagoValorizacionDto, user: Usuario): Promise<PagoValorizacion> {
    const valorizacion = await this.obtenerValorizacion(dto.idValorizacionMineral);
    const codigo = this.codigoDe(valorizacion);
    const recepcion = valorizacion.recepcionMineral;

    if (valorizacion.idEstadoValorizacion !== ESTADO_VALORIZACION_VALORIZADO) {
      throw new BadRequestException(
        `La valorización ${codigo} todavía no está VALORIZADA.`,
      );
    }
    if (await this.pagoVigente(valorizacion.id)) {
      throw new ConflictException(
        `La valorización ${codigo} ya tiene su pago registrado. Anulalo primero para registrarlo de nuevo.`,
      );
    }
    const reciboVigente = await this.dataSource.manager
      .createQueryBuilder(Recibo, 'r')
      .where('r.idValorizacionMineral = :id', { id: valorizacion.id })
      .andWhere("r.estado <> 'ANULADO'")
      .getOne();
    if (reciboVigente) {
      throw new ConflictException(
        `La valorización ${codigo} ya se pagó con el recibo ${reciboVigente.serie}-${reciboVigente.numero} (${reciboVigente.estado}).`,
      );
    }

    const personaAutorizo = await resolverPersonaAutorizo(
      this.personaRepository,
      dto.idPersonaAutorizo,
      'el pago',
    );

    const montos = this.montos(valorizacion);
    const lineas: LineaKardex[] = [];

    // Abonos: lo que el proveedor deja a kardex de su líquido.
    for (const abono of dto.abonos ?? []) {
      lineas.push({
        concepto: 'ABONO',
        kardex: await this.kardexAbiertoDe(abono, 'abono a kardex'),
        monto: this.r2(Number(abono.monto)),
      });
    }
    const idsAbono = lineas.map((l) => l.kardex.id);
    if (new Set(idsAbono).size !== idsAbono.length) {
      throw new BadRequestException(
        'Hay dos abonos al mismo kardex: juntalos en una sola línea.',
      );
    }
    const montoAbono = this.r2(lineas.reduce((s, l) => s + l.monto, 0));
    if (montoAbono > montos.aPagar) {
      throw new BadRequestException(
        `Lo que se deja a kardex (Bs ${montoAbono}) supera el líquido pagable de la valorización ${codigo} (Bs ${montos.aPagar}).`,
      );
    }
    const montoPagado = this.r2(montos.aPagar - montoAbono);

    // Anticipo de la recepción: se cancela donde el recibo lo cargó.
    if (montos.anticipo > 0) {
      let porCancelar = montos.anticipo;
      for (const { kardex, monto } of await this.kardexDelAnticipo(recepcion)) {
        const cancela = this.r2(Math.min(monto, porCancelar));
        if (cancela <= 0) break;
        lineas.push({ concepto: 'ANTICIPO', kardex, monto: cancela });
        porCancelar = this.r2(porCancelar - cancela);
      }
    }

    // Otros anticipos: se cancelan en el kardex elegido.
    if (montos.otrosAnticipos > 0) {
      if (!dto.kardexOtrosAnticipos) {
        throw new BadRequestException(
          `La valorización ${codigo} descuenta Bs ${montos.otrosAnticipos} de otros anticipos: indicá en qué kardex se cancelan.`,
        );
      }
      lineas.push({
        concepto: 'OTROS_ANTICIPOS',
        kardex: await this.kardexAbiertoDe(dto.kardexOtrosAnticipos, 'otros anticipos'),
        monto: montos.otrosAnticipos,
      });
    }

    for (const kardex of new Map(lineas.map((l) => [l.kardex.id, l.kardex])).values()) {
      await this.kardexActividadService.validarActivo(kardex);
    }

    // Forma de pago: solo hace falta si de verdad sale dinero.
    let formaPago: FormaPago | null = null;
    let cuentaBancaria: CuentaBancaria | null = null;
    let idDestinoGasto: number | null = null;
    const nroComprobante = dto.nroComprobante?.trim().toUpperCase() || null;
    if (montoPagado > 0) {
      if (!dto.idFormaPago) {
        throw new BadRequestException('Indicá la forma de pago.');
      }
      formaPago = await this.dataSource.manager.findOne(FormaPago, {
        where: { id: dto.idFormaPago },
      });
      if (!formaPago) {
        throw new NotFoundException('No existe la forma de pago seleccionada.');
      }
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
      if (dto.idDestinoGasto) {
        const destino = await this.dataSource.manager.findOne(DestinoGasto, {
          where: { id: dto.idDestinoGasto },
        });
        if (!destino) {
          throw new NotFoundException('El destino del gasto seleccionado no existe.');
        }
        idDestinoGasto = destino.id;
      }
    }
    const cajaEmpresa =
      montoPagado > 0 && !cuentaBancaria
        ? await this.movimientoCajaService.obtenerCajaAperturada(ID_CAJA_EMPRESA, MONEDA)
        : null;

    const concepto = `VALORIZACIÓN ${codigo}`;
    const referencia = `VAL:${codigo}`.slice(0, 30);
    const beneficiario = this.beneficiarioDelPago(recepcion, lineas);

    const idPago = await this.dataSource.transaction(async (manager) => {
      const pago = await manager.save(
        manager.create(PagoValorizacion, {
          idValorizacionMineral: valorizacion.id,
          fecha: dto.fecha,
          montoLiquido: montos.liquido,
          montoAbonoKardex: montoAbono,
          montoPagado,
          idFormaPago: formaPago?.id ?? null,
          idCuentaBancaria: cuentaBancaria?.id ?? null,
          nroComprobante,
          idDestinoGasto,
          idPersonaAutorizo: personaAutorizo.id,
          personaAutorizo,
          estado: 'REGISTRADO',
          usuarioRegistro: user.usuario,
        }),
      );

      // Kardex: todo HABER (baja la deuda), sin movimiento de caja.
      for (const linea of lineas) {
        const mov = await manager.save(
          manager.create(MovimientoKardex, {
            idKardex: linea.kardex.id,
            numeroLinea: await this.siguienteNumeroLinea(manager, linea.kardex.id),
            fecha: dto.fecha,
            facturaRecibo: referencia,
            detalle: `${concepto} — ${this.detalleLinea(linea.concepto)}`,
            idValorizacion: valorizacion.id,
            moneda: MONEDA,
            debe: 0,
            haber: linea.monto,
            debeUsd: 0,
            haberUsd: 0,
            saldo: 0,
            usuarioRegistro: user.usuario,
          }),
        );
        await this.recalcularKardex(manager, linea.kardex.id);
        await manager.save(
          manager.create(PagoValorizacionDetalle, {
            idPagoValorizacion: pago.id,
            concepto: linea.concepto,
            idKardex: linea.kardex.id,
            monto: linea.monto,
            idMovimientoKardex: mov.id,
            usuarioRegistro: user.usuario,
          }),
        );
      }

      // Lo que sale de verdad: egreso de caja (efectivo) o de la libreta.
      if (montoPagado > 0 && cuentaBancaria) {
        const mov = await this.libretaBancoService.crearMovimientoEnTransaccion(
          manager,
          cuentaBancaria,
          {
            fecha: dto.fecha,
            nroTransaccion: nroComprobante,
            tipoTransaccion: formaPago!.nombre,
            facturaRecibo: referencia,
            idPersona: beneficiario.idPersona,
            idActorProductivoMinero: beneficiario.idActorProductivoMinero,
            idCliente: beneficiario.idCliente,
            nombresApellidos: beneficiario.nombre,
            concepto,
            idDestinoGasto,
            debe: montoPagado,
            haber: 0,
          },
          user,
        );
        await manager.update(PagoValorizacion, pago.id, { idLibretaBanco: mov.id });
      } else if (montoPagado > 0) {
        const mov = await this.movimientoCajaService.crearMovimientoEnTransaccion(
          manager,
          cajaEmpresa!,
          {
            moneda: MONEDA,
            fecha: dto.fecha,
            nroComprobante,
            facturaRecibo: referencia,
            idFormaPago: formaPago!.id,
            idPersona: beneficiario.idPersona,
            entregaFondosA: beneficiario.nombre,
            concepto,
            idDestinoGasto,
            ingreso: 0,
            egreso: montoPagado,
          },
          user,
        );
        await manager.update(PagoValorizacion, pago.id, { idMovimientoCaja: mov.id });
      }

      return pago.id;
    });

    return this.buscarPorId(idPago);
  }

  /**
   * A nombre de quién va el egreso de caja o de libreta. Si el pago toca
   * algún kardex, es el dueño de ese kardex (quien quedó identificado como
   * titular de la cuenta), no el nombre con el que se registró la recepción
   * (que puede ser un externo). Con varios kardex manda el del anticipo de
   * la recepción, después el de otros anticipos y por último el primer
   * abono. Sin kardex, el proveedor de la recepción.
   */
  private beneficiarioDelPago(
    recepcion: RecepcionMineral | undefined,
    lineas: LineaKardex[],
  ): {
    idPersona: string | null;
    idActorProductivoMinero: string | null;
    idCliente: string | null;
    nombre: string | null;
  } {
    const orden: ConceptoPagoValorizacion[] = ['ANTICIPO', 'OTROS_ANTICIPOS', 'ABONO'];
    const kardex = orden
      .map((concepto) => lineas.find((l) => l.concepto === concepto))
      .find(Boolean)?.kardex;
    if (kardex) {
      return {
        idPersona: kardex.idPersona ?? null,
        idActorProductivoMinero: kardex.idActorProductivoMinero ?? null,
        idCliente: kardex.idCliente ?? null,
        nombre: this.nombreKardex(kardex).toUpperCase() || null,
      };
    }
    const proveedor = proveedorDeRecepcion(recepcion);
    return {
      idPersona: recepcion?.idPersona ?? null,
      idActorProductivoMinero: recepcion?.idActorProductivoMinero ?? null,
      idCliente: null,
      nombre:
        [proveedor?.nombres, proveedor?.apellidoPaterno, proveedor?.apellidoMaterno]
          .filter(Boolean)
          .join(' ')
          .trim()
          .toUpperCase() || null,
    };
  }

  private detalleLinea(concepto: ConceptoPagoValorizacion): string {
    switch (concepto) {
      case 'ANTICIPO':
        return 'DESCUENTO DE ANTICIPO';
      case 'OTROS_ANTICIPOS':
        return 'DESCUENTO DE OTROS ANTICIPOS';
      default:
        return 'ABONO A KARDEX';
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

  // ------------------------------------------------------------------ consultar / anular
  async buscarPorId(id: string): Promise<PagoValorizacion> {
    const pago = await this.pagoRepository.findOne({
      where: { id: String(id) },
      relations: RELACIONES,
    });
    if (!pago) {
      throw new NotFoundException('No se encontró el pago de valorización solicitado.');
    }
    return pago;
  }

  /**
   * Anula el pago: da de baja su movimiento de caja o de libreta y sus
   * líneas de kardex (todo se recalcula). No se puede si alguno cayó en un
   * período ya cerrado o en un kardex ya cerrado.
   */
  async anular(id: string, user: Usuario): Promise<PagoValorizacion> {
    const pago = await this.buscarPorId(id);
    if (pago.estado === 'ANULADO') {
      throw new BadRequestException('El pago ya está anulado.');
    }

    const movCaja = pago.idMovimientoCaja
      ? await this.dataSource.manager.findOne(MovimientoCaja, {
          where: { id: pago.idMovimientoCaja },
          relations: { periodoCaja: true },
        })
      : null;
    if (movCaja?.periodoCaja?.estado === 'CERRADO') {
      throw new BadRequestException(
        'El egreso de caja de este pago está en un período cerrado: no se puede anular.',
      );
    }
    const movBanco = pago.idLibretaBanco
      ? await this.dataSource.manager.findOne(LibretaBanco, {
          where: { id: pago.idLibretaBanco },
          relations: { periodoBanco: true },
        })
      : null;
    if (movBanco?.periodoBanco?.estado === 'CERRADO') {
      throw new BadRequestException(
        'El movimiento de libreta bancaria de este pago está en un período cerrado: no se puede anular.',
      );
    }
    for (const detalle of pago.detalles ?? []) {
      if (detalle.kardex?.estado !== 'ABIERTO') {
        throw new BadRequestException(
          `El kardex ${detalle.kardex?.codigo ?? detalle.idKardex} ya está cerrado: no se puede anular el pago.`,
        );
      }
    }

    await this.dataSource.transaction(async (manager) => {
      if (movCaja) {
        await this.movimientoCajaService.cambiarEstadoEnTransaccion(manager, movCaja, false, user);
      }
      if (movBanco) {
        await this.libretaBancoService.cambiarEstadoEnTransaccion(manager, movBanco, false, user);
      }
      for (const detalle of pago.detalles ?? []) {
        if (detalle.idMovimientoKardex) {
          await manager.update(MovimientoKardex, detalle.idMovimientoKardex, {
            activo: false,
            usuarioUltimaModificacion: user.usuario,
          });
          await this.recalcularKardex(manager, detalle.idKardex);
        }
      }
      await manager.update(PagoValorizacion, pago.id, {
        estado: 'ANULADO',
        usuarioUltimaModificacion: user.usuario,
      });
    });

    return this.buscarPorId(pago.id);
  }
}
