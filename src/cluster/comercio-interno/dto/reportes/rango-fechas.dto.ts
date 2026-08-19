import { Transform, Type } from 'class-transformer';
import { IsDate, IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * Filtro de período común a los reportes de recepción de mineral: rango
 * explícito (fechaDesde/fechaHasta) o, como alternativa para fraccionar
 * consultas sobre una tabla que crece indefinidamente, un mes (anio + mes)
 * o una semana ISO (anio + semana). Ver resolverRangoFechas().
 */
export class RangoFechasDto {
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
