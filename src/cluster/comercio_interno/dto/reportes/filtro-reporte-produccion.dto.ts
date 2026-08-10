import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional } from 'class-validator';
import { RangoFechasDto } from './rango-fechas.dto';

export type GranularidadReporte = 'dia' | 'semana' | 'mes' | 'anio';

export class FiltroReporteProduccionDto extends RangoFechasDto {
  @IsOptional()
  @IsIn(['dia', 'semana', 'mes', 'anio'])
  granularidad: GranularidadReporte = 'dia';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  idCodificacion?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  idEstado?: number;
}
