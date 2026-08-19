import { Type } from 'class-transformer';
import { IsInt, IsOptional } from 'class-validator';
import { RangoFechasDto } from './rango-fechas.dto';

export class FiltroReporteCodigoMineralDto extends RangoFechasDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  idEstado?: number;
}
