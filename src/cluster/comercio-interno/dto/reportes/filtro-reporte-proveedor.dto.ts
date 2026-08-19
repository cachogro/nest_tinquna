import { Type } from 'class-transformer';
import { IsInt } from 'class-validator';
import { RangoFechasDto } from './rango-fechas.dto';

export class FiltroReporteProveedorDto extends RangoFechasDto {
  // Sin fechaDesde/fechaHasta ni mes/semana, el reporte queda acumulado
  // (todo el histórico del proveedor).
  @Type(() => Number)
  @IsInt()
  idPersona: number;
}
