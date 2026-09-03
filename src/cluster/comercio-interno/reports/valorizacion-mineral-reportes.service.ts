import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { resolverRangoFechas } from 'src/common/utils/rango-fechas.util';
import { ValorizacionMineral } from '../entities/valorizacion/valorizacion-mineral.entity';
import { FiltroReporteValorizacionDto } from '../dto/reportes/filtro-reporte-valorizacion.dto';

// Estados de la valorización (parametrica.estado_valorizacion)
const ESTADO_PRE_VALORIZADO = 2;
const ESTADO_VALORIZADO = 3;

// Fecha efectiva de la valorización: la de valorización si existe, y si no
// (ej. pre-valorizada sin fecha cargada) la de registro, para que el filtro
// por fechas nunca deje registros afuera por un null.
const EXPR_FECHA_EFECTIVA =
  'COALESCE(valorizacion.fechaValorizacion ::timestamptz, valorizacion.fechaRegistro)';

export interface FilaReporteValorizacion {
  idValorizacion: string;
  codigoOperacion: string | null;
  codificacion: string | null;
  proveedor: string;
  numeroDocumento: string | null;
  numeroSacos: number | null;
  pesoKg: number;
  leyes: { mineral: string | null; ley: number; unidad: string | null }[];
  montoBrutoBs: number | null;
  montoPagarBs: number;
  montoNetoBs: number;
  entregado: boolean;
  fechaEntregado: Date | null;
  idEstadoValorizacion: number | null;
  estadoValorizacion: string | null;
  fechaValorizacion: string | null;
  observaciones: string | null;
}

export interface ReporteValorizacionResultado {
  filtros: {
    estado: string;
    entregado: string;
    idCodificacion: number | null;
    codificacion: string | null;
    desde: Date | null;
    hasta: Date | null;
  };
  resumen: {
    cantidad: number;
    cantidadPreValorizadas: number;
    cantidadValorizadas: number;
    cantidadEntregados: number;
    cantidadNoEntregados: number;
    totalSacos: number;
    totalPesoKg: number;
    totalMontoBrutoBs: number;
    totalMontoPagarBs: number;
    totalMontoNetoBs: number;
  };
  valorizaciones: FilaReporteValorizacion[];
}

@Injectable()
export class ValorizacionMineralReportesService {
  constructor(
    @InjectRepository(ValorizacionMineral, 'ci')
    private readonly valorizacionRepository: Repository<ValorizacionMineral>,
  ) {}

  /**
   * Devuelve todas las valorizaciones que cumplan el filtro (sin paginar),
   * más un resumen con los totales. Pensado para el reporte de la Hoja3
   * (lote, proveedor, sacos, peso, ley, monto a pagar, entregado).
   */
  async reporte(
    filtros: FiltroReporteValorizacionDto,
  ): Promise<ReporteValorizacionResultado> {
    const { estado = 'ambas', entregado = 'ambos', idCodificacion } = filtros;
    const { desde, hasta } = resolverRangoFechas(filtros);

    const estados =
      estado === 'pre_valorizadas'
        ? [ESTADO_PRE_VALORIZADO]
        : estado === 'valorizadas'
          ? [ESTADO_VALORIZADO]
          : [ESTADO_PRE_VALORIZADO, ESTADO_VALORIZADO];

    const query = this.valorizacionRepository
      .createQueryBuilder('valorizacion')
      .leftJoinAndSelect('valorizacion.recepcionMineral', 'recepcion')
      .leftJoinAndSelect('recepcion.persona', 'persona')
      .leftJoinAndSelect('recepcion.codificacion', 'codificacion')
      .leftJoinAndSelect('valorizacion.estadoValorizacion', 'estadoValorizacion')
      .leftJoinAndSelect(
        'valorizacion.detalles',
        'detalle',
        'detalle.activo = true',
      )
      .leftJoinAndSelect('detalle.mineral', 'mineral')
      .where('valorizacion.activo = true')
      .andWhere('valorizacion.idEstadoValorizacion IN (:...estados)', {
        estados,
      });

    if (entregado === 'entregados') {
      query.andWhere('valorizacion.entregado = true');
    } else if (entregado === 'no_entregados') {
      query.andWhere('valorizacion.entregado = false');
    }

    if (idCodificacion) {
      query.andWhere('recepcion.idCodificacion = :idCodificacion', {
        idCodificacion,
      });
    }

    if (desde) {
      query.andWhere(`${EXPR_FECHA_EFECTIVA} >= :desde`, { desde });
    }

    if (hasta) {
      query.andWhere(`${EXPR_FECHA_EFECTIVA} <= :hasta`, { hasta });
    }

    query
      .orderBy('valorizacion.fechaValorizacion', 'ASC')
      .addOrderBy('valorizacion.id', 'ASC');

    const valorizaciones = await query.getMany();

    const filas: FilaReporteValorizacion[] = valorizaciones.map((v) => ({
      idValorizacion: v.id,
      codigoOperacion: v.recepcionMineral?.codigoOperacion ?? null,
      codificacion: v.recepcionMineral?.codificacion?.codigo ?? null,
      proveedor: this.nombreCompleto(v.recepcionMineral?.persona),
      numeroDocumento: v.recepcionMineral?.persona?.numeroDocumento ?? null,
      numeroSacos: v.recepcionMineral?.numeroSacos ?? null,
      pesoKg: Number(
        v.pesoNetoSecoKilogramos ??
          v.pesoBrutoSecoKilogramos ??
          v.pesoBrutoHumedoKilogramos ??
          0,
      ),
      leyes: (v.detalles ?? []).map((d) => ({
        mineral: d.mineral?.simbolo ?? d.mineral?.descripcion ?? null,
        ley: Number(d.ley),
        unidad: d.leyUnidad ?? null,
      })),
      montoBrutoBs:
        v.totalValorBrutoBolivianos != null
          ? Number(v.totalValorBrutoBolivianos)
          : null,
      montoPagarBs: Number(v.totalValorLiquidoVentaBolivianos ?? 0),
      montoNetoBs: Number(v.totalValorNetoVentaBolivianos ?? 0),
      entregado: v.entregado,
      fechaEntregado: v.fechaEntregado ?? null,
      idEstadoValorizacion: v.idEstadoValorizacion ?? null,
      estadoValorizacion: v.estadoValorizacion?.nombre ?? null,
      fechaValorizacion: v.fechaValorizacion ?? null,
      observaciones: v.observaciones ?? null,
    }));

    const resumen = {
      cantidad: filas.length,
      cantidadPreValorizadas: filas.filter(
        (f) => f.idEstadoValorizacion === ESTADO_PRE_VALORIZADO,
      ).length,
      cantidadValorizadas: filas.filter(
        (f) => f.idEstadoValorizacion === ESTADO_VALORIZADO,
      ).length,
      cantidadEntregados: filas.filter((f) => f.entregado).length,
      cantidadNoEntregados: filas.filter((f) => !f.entregado).length,
      totalSacos: this.sumar(filas, (f) => f.numeroSacos ?? 0),
      totalPesoKg: this.redondear(this.sumar(filas, (f) => f.pesoKg), 2),
      totalMontoBrutoBs: this.redondear(
        this.sumar(filas, (f) => f.montoBrutoBs ?? 0),
        2,
      ),
      totalMontoPagarBs: this.redondear(
        this.sumar(filas, (f) => f.montoPagarBs),
        2,
      ),
      totalMontoNetoBs: this.redondear(
        this.sumar(filas, (f) => f.montoNetoBs),
        2,
      ),
    };

    return {
      filtros: {
        estado,
        entregado,
        idCodificacion: idCodificacion ?? null,
        codificacion: idCodificacion ? (filas[0]?.codificacion ?? null) : null,
        desde: desde ?? null,
        hasta: hasta ?? null,
      },
      resumen,
      valorizaciones: filas,
    };
  }

  private nombreCompleto(persona?: {
    nombres?: string;
    apellidoPaterno?: string;
    apellidoMaterno?: string;
  }): string {
    if (!persona) {
      return '--';
    }

    return `${persona.nombres ?? ''} ${persona.apellidoPaterno ?? ''} ${
      persona.apellidoMaterno ?? ''
    }`
      .replace(/\s+/g, ' ')
      .trim();
  }

  private sumar(
    filas: FilaReporteValorizacion[],
    selector: (fila: FilaReporteValorizacion) => number,
  ): number {
    return filas.reduce((acumulado, fila) => acumulado + selector(fila), 0);
  }

  private redondear(valor: number, decimales: number): number {
    const factor = 10 ** decimales;
    return Math.round(valor * factor) / factor;
  }
}
