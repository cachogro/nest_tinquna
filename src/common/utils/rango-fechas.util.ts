import { BadRequestException } from '@nestjs/common';

export interface FiltroRangoFechas {
  fechaDesde?: Date;
  fechaHasta?: Date;
  anio?: number;
  mes?: number;
  semana?: number;
}

export interface RangoFechas {
  desde?: Date;
  hasta?: Date;
}

/**
 * Resuelve el rango de fechas a aplicar en un filtro. Acepta un rango
 * explícito (fechaDesde/fechaHasta) o, como alternativa para fraccionar
 * consultas/exportaciones masivas, un mes (anio + mes) o una semana ISO
 * (anio + semana) que se traduce a un rango de fechas exacto.
 */
export function resolverRangoFechas(filtros: FiltroRangoFechas): RangoFechas {
  const { anio, mes, semana, fechaDesde, fechaHasta } = filtros;

  if (mes && semana) {
    throw new BadRequestException(
      'No se puede filtrar por mes y semana al mismo tiempo.',
    );
  }

  if ((mes || semana) && (fechaDesde || fechaHasta)) {
    throw new BadRequestException(
      'No se puede combinar mes/semana con fechaDesde/fechaHasta. Use uno u otro.',
    );
  }

  if (mes) {
    if (!anio) {
      throw new BadRequestException('Debe indicar el año junto con el mes.');
    }

    return {
      desde: new Date(anio, mes - 1, 1, 0, 0, 0, 0),
      hasta: new Date(anio, mes, 0, 23, 59, 59, 999),
    };
  }

  if (semana) {
    if (!anio) {
      throw new BadRequestException(
        'Debe indicar el año junto con la semana.',
      );
    }

    return calcularRangoSemanaIso(anio, semana);
  }

  const hasta = fechaHasta ? new Date(fechaHasta) : undefined;

  if (hasta) {
    hasta.setHours(23, 59, 59, 999);
  }

  return { desde: fechaDesde, hasta };
}

/**
 * Calcula el lunes-domingo (00:00:00.000 - 23:59:59.999) de una semana
 * ISO 8601. El 4 de enero siempre cae en la semana 1 de su año.
 */
export function calcularRangoSemanaIso(
  anio: number,
  semana: number,
): { desde: Date; hasta: Date } {
  const enero4 = new Date(anio, 0, 4);
  const diaSemanaEnero4 = (enero4.getDay() + 6) % 7; // 0 = lunes

  const lunesSemana1 = new Date(enero4);
  lunesSemana1.setDate(enero4.getDate() - diaSemanaEnero4);

  const desde = new Date(lunesSemana1);
  desde.setDate(lunesSemana1.getDate() + (semana - 1) * 7);
  desde.setHours(0, 0, 0, 0);

  const hasta = new Date(desde);
  hasta.setDate(desde.getDate() + 6);
  hasta.setHours(23, 59, 59, 999);

  return { desde, hasta };
}

/**
 * Igual que resolverRangoFechas, pero exige que el rango quede acotado.
 * Se usa en reportes agregados que recorrerían toda la tabla si no se
 * les obliga a acotar por fecha (rango explícito o mes/semana).
 */
export function resolverRangoFechasObligatorio(
  filtros: FiltroRangoFechas,
): Required<RangoFechas> {
  const { desde, hasta } = resolverRangoFechas(filtros);

  if (!desde || !hasta) {
    throw new BadRequestException(
      'Debe indicar un rango de fechas (fechaDesde/fechaHasta) o un período (anio+mes / anio+semana).',
    );
  }

  return { desde, hasta };
}
