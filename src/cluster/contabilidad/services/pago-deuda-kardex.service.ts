import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { Usuario } from 'src/security/entities/usuario.entity';
import { FormaPago } from 'src/cluster/parametricas/entities/forma-pago.entity';
import { Kardex, TipoKardex } from '../entities/kardex.entity';
import { MovimientoKardex } from '../entities/movimiento-kardex.entity';
import { CreateMovimientoKardexDto } from '../dto/movimiento-kardex/create-movimiento-kardex.dto';
import { CreateReciboDto } from '../dto/recibo/create-recibo.dto';
import { MovimientoKardexService } from './movimiento-kardex.service';
import { ReciboService } from './recibo.service';

// Kardex de una persona (deuda personal): su pago siempre emite recibo.
const TIPOS_KARDEX_PERSONA: TipoKardex[] = ['PERSONAL', 'ASOCIADO'];

const RELACIONES = {
  subcuenta: true,
  formaPago: true,
  planCuentas: true,
  cobrador: true,
  valorizacion: true,
  cuentaBancaria: { entidadFinanciera: true },
  movimientosCaja: { planCuentas: true },
  recibo: true,
} as const;

/**
 * Pago de una deuda personal cargado desde el kardex: en vez de dejar solo la
 * línea HABER, emite un recibo de INGRESO ya PROCESADO (un solo paso, sin
 * pasar por BORRADOR) y es ese recibo el que postea la línea del kardex y la
 * entrada a caja o a la libreta de bancos. Así todo dinero recibido por una
 * deuda personal queda respaldado por su recibo R-, listo para imprimir.
 *
 * Vive aparte de MovimientoKardexService porque ReciboService ya depende de
 * él (vía VentaLoteService): inyectarlo allá cerraría un ciclo.
 */
@Injectable()
export class PagoDeudaKardexService {
  constructor(
    @InjectRepository(Kardex, 'ci')
    private readonly kardexRepository: Repository<Kardex>,

    @InjectRepository(FormaPago, 'ci')
    private readonly formaPagoRepository: Repository<FormaPago>,

    private readonly movimientoKardexService: MovimientoKardexService,
    private readonly reciboService: ReciboService,

    @InjectDataSource('ci')
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Punto de entrada del `POST /contabilidad/movimiento-kardex`: el pago de
   * una deuda personal va por recibo; todo lo demás (anticipos, otros tipos
   * de kardex, actualizaciones) sigue como una línea directa.
   */
  async guardar(
    dto: CreateMovimientoKardexDto,
    user: Usuario,
  ): Promise<MovimientoKardex> {
    const kardex = await this.kardexDePagoConRecibo(dto);
    return kardex
      ? this.pagarConRecibo(kardex, dto, user)
      : this.movimientoKardexService.guardar(dto, user);
  }

  /**
   * Devuelve el kardex si la línea es el pago de una deuda personal que
   * mueve dinero: alta de un HABER en un kardex PERSONAL/ASOCIADO con una
   * forma de pago real. Las formas internas (afectaFondo = false, ej.
   * TRANZADO) no reciben plata: quedan como línea directa, sin recibo.
   */
  private async kardexDePagoConRecibo(
    dto: CreateMovimientoKardexDto,
  ): Promise<Kardex | null> {
    if (dto.id || dto.tipo !== 'HABER') return null;

    const kardex = await this.kardexRepository.findOne({
      where: { id: dto.idKardex },
    });
    // Sin kardex, cerrado o de otro tipo: lo resuelve (o rechaza) el flujo
    // de la línea directa.
    if (
      !kardex ||
      kardex.estado === 'CERRADO' ||
      !kardex.idPersona ||
      !TIPOS_KARDEX_PERSONA.includes(kardex.tipo)
    ) {
      return null;
    }

    if (dto.idFormaPago) {
      const formaPago = await this.formaPagoRepository.findOne({
        where: { id: dto.idFormaPago },
      });
      if (formaPago?.afectaFondo === false) return null;
    }
    return kardex;
  }

  private async pagarConRecibo(
    kardex: Kardex,
    dto: CreateMovimientoKardexDto,
    user: Usuario,
  ): Promise<MovimientoKardex> {
    await this.movimientoKardexService.validarReferenciasOpcionales(dto);

    const reciboDto = {
      tipo: 'INGRESO',
      fecha: dto.fecha,
      montoTotal: dto.monto,
      moneda: dto.moneda,
      tipoCambio: dto.tipoCambio,
      concepto: dto.detalle,
      idFormaPago: dto.idFormaPago,
      idCuentaBancaria: dto.idCuentaBancaria,
      nroComprobante: dto.nroComprobante,
      idPersona: kardex.idPersona,
      idPersonaAutorizo: dto.idPersonaAutorizo,
      detalles: [
        {
          destino: 'PERSONAL',
          idPersona: kardex.idPersona,
          monto: dto.monto,
          idPlanCuentas: dto.idPlanCuentas,
          lote: dto.lote,
        },
      ],
    } as CreateReciboDto;

    return this.dataSource.transaction(async (manager) => {
      const recibo = await this.reciboService.generarEnTransaccion(
        manager,
        reciboDto,
        user,
      );

      const linea = await manager.findOne(MovimientoKardex, {
        where: { idRecibo: recibo.id },
      });
      // El recibo busca el kardex abierto de la persona: tiene que ser el
      // mismo sobre el que se cargó el pago.
      if (!linea || String(linea.idKardex) !== String(kardex.id)) {
        throw new BadRequestException(
          `El pago no pudo aplicarse al kardex ${kardex.codigo}: la persona tiene otro kardex abierto. Generá el recibo de ingreso desde Recibos.`,
        );
      }

      // Datos propios de la línea que el recibo no lleva.
      await manager.update(MovimientoKardex, linea.id, {
        idSubcuenta: dto.idSubcuenta ?? null,
        idValorizacion: dto.idValorizacion ? String(dto.idValorizacion) : null,
        ...(dto.idCobrador ? { idCobrador: String(dto.idCobrador) } : {}),
      });

      return manager.findOne(MovimientoKardex, {
        where: { id: linea.id },
        relations: RELACIONES,
      });
    });
  }
}
