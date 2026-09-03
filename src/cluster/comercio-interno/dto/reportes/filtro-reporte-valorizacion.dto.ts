import { Transform, Type } from 'class-transformer';
import { IsDate, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * Alcance por estado de la valorización para el reporte.
 *  - AMBAS: pre-valorizadas (2) + valorizadas (3)
 *  - PRE_VALORIZADAS: solo estado 2
 *  - VALORIZADAS: solo estado 3
 */
export type EstadoValorizacionReporte =
  | 'ambas'
  | 'pre_valorizadas'
  | 'valorizadas';

/**
 * Alcance por el campo `entregado` (material que salió del ingenio).
 *  - AMBOS: entregados y no entregados
 *  - ENTREGADOS: solo entregado = true
 *  - NO_ENTREGADOS: solo entregado = false
 */
export type EntregadoReporte = 'ambos' | 'entregados' | 'no_entregados';

/**
 * DTO para GET /comercio_interno/reportes/valorizacion_mineral
 *
 * Trae TODAS las valorizaciones que cumplan el filtro (no pagina). Si no se
 * envía rango de fechas ni mes, devuelve todo el histórico.
 *
 * Fechas (excluyentes entre sí):
 *  - fechaDesde / fechaHasta: rango explícito.
 *  - anio + mes: un mes completo.
 *  - anio + semana: una semana ISO.
 */
export class FiltroReporteValorizacionDto {
  @IsOptional()
  @IsIn(['ambas', 'pre_valorizadas', 'valorizadas'])
  estado: EstadoValorizacionReporte = 'ambas';

  @IsOptional()
  @IsIn(['ambos', 'entregados', 'no_entregados'])
  entregado: EntregadoReporte = 'ambos';

  /**
   * Id de la codificación de la recepción (parametrica.codificacion, ej. ICC).
   * Opcional: si se envía, el reporte trae solo las valorizaciones de esa
   * codificación; si no, trae todas. Se combina con el resto de filtros.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  idCodificacion?: number;

  @IsOptional()
  @Transform(({ value }) => (value ? new Date(`${value}`) : undefined))
  @IsDate()
  fechaDesde?: Date;

  @IsOptional()
  @Transform(({ value }) => (value ? new Date(`${value}`) : undefined))
  @IsDate()
  fechaHasta?: Date;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  anio?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  mes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(53)
  semana?: number;
}
