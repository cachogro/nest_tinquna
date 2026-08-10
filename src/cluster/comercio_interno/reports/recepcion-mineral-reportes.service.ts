import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RecepcionMineral } from '../entities/recepcion_mineral/recepcion-mineral.entity';
import {
  resolverRangoFechas,
  resolverRangoFechasObligatorio,
} from 'src/common/utils/rango-fechas.util';
import { FiltroReporteProduccionDto } from '../dto/reportes/filtro-reporte-produccion.dto';
import { FiltroReporteProveedorDto } from '../dto/reportes/filtro-reporte-proveedor.dto';
import { FiltroReporteCodigoMineralDto } from '../dto/reportes/filtro-reporte-codigo-mineral.dto';
import { FiltroReporteEstadoDto } from '../dto/reportes/filtro-reporte-estado.dto';
import { FiltroReporteCicloDto } from '../dto/reportes/filtro-reporte-ciclo.dto';
import { FiltroReporteAnticiposDto } from '../dto/reportes/filtro-reporte-anticipos.dto';

// SUM(recepcion.balanzaL - recepcion.balanzaT): "balanza L" (llegada/bruto) y
// "balanza T" (tara) son las únicas columnas de peso que existen hoy; no hay
// una columna "neto" propia, así que el neto se deriva de estas dos.
const EXPR_PESO_NETO = 'recepcion.balanzaL - recepcion.balanzaT';

const TRUNC_POR_GRANULARIDAD: Record<string, string> = {
  dia: 'day',
  semana: 'week',
  mes: 'month',
  anio: 'year',
};

@Injectable()
export class RecepcionMineralReportesService {
  constructor(
    @InjectRepository(RecepcionMineral, 'ci')
    private readonly recepcionRepository: Repository<RecepcionMineral>,
  ) {}

  //---------------------------------------------------------------------
  // 1. Producción por período (día/semana/mes/año)
  //---------------------------------------------------------------------

  async produccionPorPeriodo(filtros: FiltroReporteProduccionDto) {
    const { granularidad = 'dia', idCodificacion, idEstado } = filtros;
    const { desde, hasta } = resolverRangoFechasObligatorio(filtros);
    const trunc = TRUNC_POR_GRANULARIDAD[granularidad];

    const query = this.recepcionRepository
      .createQueryBuilder('recepcion')
      .where('recepcion.fechaRecepcion ::timestamptz >= :desde', { desde })
      .andWhere('recepcion.fechaRecepcion ::timestamptz <= :hasta', {
        hasta,
      });

    if (idCodificacion) {
      query.andWhere('recepcion.idCodificacion = :idCodificacion', {
        idCodificacion,
      });
    }

    if (idEstado) {
      query.andWhere('recepcion.idEstado = :idEstado', { idEstado });
    }

    query
      .select(
        `date_trunc('${trunc}', recepcion.fechaRecepcion ::timestamptz)`,
        'periodo',
      )
      .addSelect('COUNT(*)', 'cantidadRecepciones')
      .addSelect('COALESCE(SUM(recepcion.numeroSacos), 0)', 'totalSacos')
      .addSelect('COALESCE(SUM(recepcion.balanzaL), 0)', 'pesoBrutoTotalKg')
      .addSelect('COALESCE(SUM(recepcion.balanzaT), 0)', 'taraTotalKg')
      .addSelect(`COALESCE(SUM(${EXPR_PESO_NETO}), 0)`, 'pesoNetoTotalKg')
      .groupBy(
        `date_trunc('${trunc}', recepcion.fechaRecepcion ::timestamptz)`,
      )
      .orderBy(
        `date_trunc('${trunc}', recepcion.fechaRecepcion ::timestamptz)`,
        'ASC',
      );

    const filas = await query.getRawMany<{
      periodo: string;
      cantidadRecepciones: string;
      totalSacos: string;
      pesoBrutoTotalKg: string;
      taraTotalKg: string;
      pesoNetoTotalKg: string;
    }>();

    return filas.map((fila) => ({
      periodo: fila.periodo,
      cantidadRecepciones: Number(fila.cantidadRecepciones),
      totalSacos: Number(fila.totalSacos),
      pesoBrutoTotalKg: Number(fila.pesoBrutoTotalKg),
      taraTotalKg: Number(fila.taraTotalKg),
      pesoNetoTotalKg: Number(fila.pesoNetoTotalKg),
    }));
  }

  //---------------------------------------------------------------------
  // 2. Histórico por proveedor (rango de fechas o acumulado)
  //---------------------------------------------------------------------

  async porProveedor(filtros: FiltroReporteProveedorDto) {
    const { idPersona } = filtros;
    const { desde, hasta } = resolverRangoFechas(filtros);

    const base = this.recepcionRepository
      .createQueryBuilder('recepcion')
      .innerJoin('recepcion.estado', 'estado')
      .where('recepcion.idPersona = :idPersona', { idPersona });

    if (desde) {
      base.andWhere('recepcion.fechaRecepcion ::timestamptz >= :desde', {
        desde,
      });
    }

    if (hasta) {
      base.andWhere('recepcion.fechaRecepcion ::timestamptz <= :hasta', {
        hasta,
      });
    }

    const resumen = await base
      .clone()
      .select('COUNT(*)', 'cantidadRecepciones')
      .addSelect('COALESCE(SUM(recepcion.numeroSacos), 0)', 'totalSacos')
      .addSelect('COALESCE(SUM(recepcion.balanzaL), 0)', 'pesoBrutoTotalKg')
      .addSelect(`COALESCE(SUM(${EXPR_PESO_NETO}), 0)`, 'pesoNetoTotalKg')
      .addSelect('COALESCE(SUM(recepcion.anticipo), 0)', 'totalAnticiposBs')
      .addSelect('MIN(recepcion.fechaRecepcion)', 'primeraRecepcion')
      .addSelect('MAX(recepcion.fechaRecepcion)', 'ultimaRecepcion')
      .getRawOne<{
        cantidadRecepciones: string;
        totalSacos: string;
        pesoBrutoTotalKg: string;
        pesoNetoTotalKg: string;
        totalAnticiposBs: string;
        primeraRecepcion: string | null;
        ultimaRecepcion: string | null;
      }>();

    const porEstado = await base
      .clone()
      .select('estado.nombre', 'estado')
      .addSelect('COUNT(*)', 'cantidad')
      .groupBy('estado.nombre')
      .orderBy('COUNT(*)', 'DESC')
      .getRawMany<{ estado: string; cantidad: string }>();

    return {
      idPersona,
      cantidadRecepciones: Number(resumen?.cantidadRecepciones ?? 0),
      totalSacos: Number(resumen?.totalSacos ?? 0),
      pesoBrutoTotalKg: Number(resumen?.pesoBrutoTotalKg ?? 0),
      pesoNetoTotalKg: Number(resumen?.pesoNetoTotalKg ?? 0),
      totalAnticiposBs: Number(resumen?.totalAnticiposBs ?? 0),
      primeraRecepcion: resumen?.primeraRecepcion ?? null,
      ultimaRecepcion: resumen?.ultimaRecepcion ?? null,
      porEstado: porEstado.map((fila) => ({
        estado: fila.estado,
        cantidad: Number(fila.cantidad),
      })),
    };
  }

  //---------------------------------------------------------------------
  // 3. Por código de mineral (ICC, etc.)
  //---------------------------------------------------------------------

  async porCodigoMineral(filtros: FiltroReporteCodigoMineralDto) {
    const { idEstado } = filtros;
    const { desde, hasta } = resolverRangoFechasObligatorio(filtros);

    const query = this.recepcionRepository
      .createQueryBuilder('recepcion')
      .innerJoin('recepcion.codificacion', 'codificacion')
      .where('recepcion.fechaRecepcion ::timestamptz >= :desde', { desde })
      .andWhere('recepcion.fechaRecepcion ::timestamptz <= :hasta', {
        hasta,
      });

    if (idEstado) {
      query.andWhere('recepcion.idEstado = :idEstado', { idEstado });
    }

    query
      .select('codificacion.codigo', 'codigo')
      .addSelect('codificacion.nombre', 'nombreCodificacion')
      .addSelect('COUNT(*)', 'cantidadRecepciones')
      .addSelect(
        'COUNT(DISTINCT recepcion.idPersona)',
        'cantidadProveedores',
      )
      .addSelect('COALESCE(SUM(recepcion.numeroSacos), 0)', 'totalSacos')
      .addSelect('COALESCE(SUM(recepcion.balanzaL), 0)', 'pesoBrutoTotalKg')
      .addSelect(`COALESCE(SUM(${EXPR_PESO_NETO}), 0)`, 'pesoNetoTotalKg')
      .groupBy('codificacion.codigo')
      .addGroupBy('codificacion.nombre')
      .orderBy('SUM(recepcion.balanzaL)', 'DESC');

    const filas = await query.getRawMany<{
      codigo: string;
      nombreCodificacion: string;
      cantidadRecepciones: string;
      cantidadProveedores: string;
      totalSacos: string;
      pesoBrutoTotalKg: string;
      pesoNetoTotalKg: string;
    }>();

    return filas.map((fila) => ({
      codigo: fila.codigo,
      nombreCodificacion: fila.nombreCodificacion,
      cantidadRecepciones: Number(fila.cantidadRecepciones),
      cantidadProveedores: Number(fila.cantidadProveedores),
      totalSacos: Number(fila.totalSacos),
      pesoBrutoTotalKg: Number(fila.pesoBrutoTotalKg),
      pesoNetoTotalKg: Number(fila.pesoNetoTotalKg),
    }));
  }

  //---------------------------------------------------------------------
  // 4. Por estado (dashboard operativo, conteos, no exportación masiva)
  //---------------------------------------------------------------------

  async porEstado(filtros: FiltroReporteEstadoDto) {
    const { desde, hasta } = resolverRangoFechas(filtros);

    const query = this.recepcionRepository
      .createQueryBuilder('recepcion')
      .innerJoin('recepcion.estado', 'estado');

    if (desde) {
      query.andWhere('recepcion.fechaRecepcion ::timestamptz >= :desde', {
        desde,
      });
    }

    if (hasta) {
      query.andWhere('recepcion.fechaRecepcion ::timestamptz <= :hasta', {
        hasta,
      });
    }

    query
      .select('estado.id', 'idEstado')
      .addSelect('estado.nombre', 'estado')
      .addSelect('COUNT(*)', 'cantidad')
      .groupBy('estado.id')
      .addGroupBy('estado.nombre')
      .orderBy('estado.id', 'ASC');

    const filas = await query.getRawMany<{
      idEstado: number;
      estado: string;
      cantidad: string;
    }>();

    return filas.map((fila) => ({
      idEstado: Number(fila.idEstado),
      estado: fila.estado,
      cantidad: Number(fila.cantidad),
    }));
  }

  //---------------------------------------------------------------------
  // 5. Tiempo de ciclo: recepción -> primera valorización asociada
  //---------------------------------------------------------------------

  async tiempoCiclo(filtros: FiltroReporteCicloDto) {
    const { idCodificacion, idEstado } = filtros;
    const { desde, hasta } = resolverRangoFechasObligatorio(filtros);

    // Se promedia sobre todas las valorizaciones asociadas a la recepción
    // (no solo la primera): si una recepción tuvo remuestreo y generó más
    // de una valorización, cada una aporta su propio tiempo de ciclo.
    const query = this.recepcionRepository
      .createQueryBuilder('recepcion')
      .innerJoin('recepcion.valorizaciones', 'valorizacion')
      .where('recepcion.fechaRecepcion ::timestamptz >= :desde', { desde })
      .andWhere('recepcion.fechaRecepcion ::timestamptz <= :hasta', {
        hasta,
      });

    if (idCodificacion) {
      query.andWhere('recepcion.idCodificacion = :idCodificacion', {
        idCodificacion,
      });
    }

    if (idEstado) {
      query.andWhere('recepcion.idEstado = :idEstado', { idEstado });
    }

    const expresionDias =
      'EXTRACT(EPOCH FROM (valorizacion.fechaRegistro - recepcion.fechaRecepcion ::timestamptz)) / 86400';

    const resultado = await query
      .select(`AVG(${expresionDias})`, 'promedioDias')
      .addSelect(`MIN(${expresionDias})`, 'minimoDias')
      .addSelect(`MAX(${expresionDias})`, 'maximoDias')
      .addSelect('COUNT(*)', 'cantidadValorizaciones')
      .getRawOne<{
        promedioDias: string | null;
        minimoDias: string | null;
        maximoDias: string | null;
        cantidadValorizaciones: string;
      }>();

    return {
      cantidadValorizaciones: Number(resultado?.cantidadValorizaciones ?? 0),
      promedioDias:
        resultado?.promedioDias != null ? Number(resultado.promedioDias) : null,
      minimoDias:
        resultado?.minimoDias != null ? Number(resultado.minimoDias) : null,
      maximoDias:
        resultado?.maximoDias != null ? Number(resultado.maximoDias) : null,
    };
  }

  //---------------------------------------------------------------------
  // 6. Anticipos entregados por período/proveedor
  //---------------------------------------------------------------------

  async anticipos(filtros: FiltroReporteAnticiposDto) {
    const { idPersona } = filtros;
    const { desde, hasta } = resolverRangoFechasObligatorio(filtros);

    const query = this.recepcionRepository
      .createQueryBuilder('recepcion')
      .innerJoin('recepcion.persona', 'persona')
      .where('recepcion.fechaRecepcion ::timestamptz >= :desde', { desde })
      .andWhere('recepcion.fechaRecepcion ::timestamptz <= :hasta', {
        hasta,
      })
      .andWhere('recepcion.anticipo IS NOT NULL');

    if (idPersona) {
      query.andWhere('recepcion.idPersona = :idPersona', { idPersona });
    }

    query
      .select('recepcion.idPersona', 'idPersona')
      .addSelect(
        `CONCAT(persona.nombres, ' ', persona.apellidoPaterno, ' ', COALESCE(persona.apellidoMaterno, ''))`,
        'proveedor',
      )
      .addSelect('COUNT(*)', 'cantidadAnticipos')
      .addSelect('COALESCE(SUM(recepcion.anticipo), 0)', 'totalAnticipoBs')
      .groupBy('recepcion.idPersona')
      .addGroupBy('persona.nombres')
      .addGroupBy('persona.apellidoPaterno')
      .addGroupBy('persona.apellidoMaterno')
      .orderBy('SUM(recepcion.anticipo)', 'DESC');

    const filas = await query.getRawMany<{
      idPersona: string;
      proveedor: string;
      cantidadAnticipos: string;
      totalAnticipoBs: string;
    }>();

    return filas.map((fila) => ({
      idPersona: fila.idPersona,
      proveedor: fila.proveedor?.trim(),
      cantidadAnticipos: Number(fila.cantidadAnticipos),
      totalAnticipoBs: Number(fila.totalAnticipoBs),
    }));
  }

  //---------------------------------------------------------------------
  // 7. Anticipo (recepción) vs. valor final liquidado (valorización)
  //---------------------------------------------------------------------

  async anticipoVsLiquidado(filtros: FiltroReporteAnticiposDto) {
    const { idPersona } = filtros;
    const { desde, hasta } = resolverRangoFechasObligatorio(filtros);

    const query = this.recepcionRepository
      .createQueryBuilder('recepcion')
      .innerJoin('recepcion.persona', 'persona')
      .innerJoin('recepcion.valorizaciones', 'valorizacion')
      .where('recepcion.fechaRecepcion ::timestamptz >= :desde', { desde })
      .andWhere('recepcion.fechaRecepcion ::timestamptz <= :hasta', {
        hasta,
      })
      .andWhere('valorizacion.liquidoPagableBolivianos IS NOT NULL');

    if (idPersona) {
      query.andWhere('recepcion.idPersona = :idPersona', { idPersona });
    }

    const expresionDiferencia =
      'valorizacion.liquidoPagableBolivianos - COALESCE(recepcion.anticipo, 0)';

    query
      .select('recepcion.id', 'idRecepcion')
      .addSelect('recepcion.codigoOperacion', 'codigoOperacion')
      .addSelect(
        `CONCAT(persona.nombres, ' ', persona.apellidoPaterno, ' ', COALESCE(persona.apellidoMaterno, ''))`,
        'proveedor',
      )
      .addSelect('COALESCE(recepcion.anticipo, 0)', 'anticipoRecepcion')
      .addSelect('valorizacion.liquidoPagableBolivianos', 'valorLiquidado')
      .addSelect(expresionDiferencia, 'diferencia')
      .orderBy(expresionDiferencia, 'ASC'); // los sobre-anticipos (más negativos) primero

    const filas = await query.getRawMany<{
      idRecepcion: string;
      codigoOperacion: string;
      proveedor: string;
      anticipoRecepcion: string;
      valorLiquidado: string;
      diferencia: string;
    }>();

    const detalle = filas.map((fila) => {
      const diferencia = Number(fila.diferencia);

      return {
        idRecepcion: fila.idRecepcion,
        codigoOperacion: fila.codigoOperacion,
        proveedor: fila.proveedor?.trim(),
        anticipoRecepcion: Number(fila.anticipoRecepcion),
        valorLiquidado: Number(fila.valorLiquidado),
        diferencia,
        sobreAnticipo: diferencia < 0,
      };
    });

    const conSobreAnticipo = detalle.filter((fila) => fila.sobreAnticipo);

    return {
      cantidad: detalle.length,
      cantidadConSobreAnticipo: conSobreAnticipo.length,
      totalSobreAnticipoBs: conSobreAnticipo.reduce(
        (acumulado, fila) => acumulado + Math.abs(fila.diferencia),
        0,
      ),
      detalle,
    };
  }
}
