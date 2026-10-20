import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { FormatoReporteDto } from '../reporte/formato-reporte.dto';

/**
 * Query del `GET /contabilidad/boleta-pago/planilla-firmas` (y su Excel).
 * Sin gestion/mes, el mes actual; sin idTipoContrato, todo el personal.
 */
export class PlanillaFirmasDto extends FormatoReporteDto {
  @ApiPropertyOptional({ example: 2026 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La gestión debe ser un número entero.' })
  @Min(2000, { message: 'La gestión no es válida.' })
  gestion?: number;

  @ApiPropertyOptional({ example: 9 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El mes debe ser un número entero.' })
  @Min(1, { message: 'El mes debe estar entre 1 y 12.' })
  @Max(12, { message: 'El mes debe estar entre 1 y 12.' })
  mes?: number;

  @ApiPropertyOptional({ example: 1, description: 'Solo el personal con este tipo de contrato. Sin él, todo el personal.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El tipo de contrato no es válido.' })
  idTipoContrato?: number;
}
