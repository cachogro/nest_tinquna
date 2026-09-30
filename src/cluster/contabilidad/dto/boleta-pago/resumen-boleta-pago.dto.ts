import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * Query del `GET /contabilidad/boleta-pago/resumen`: mes a resumir. Sin
 * gestion/mes se usa el mes actual (hora de Bolivia).
 */
export class ResumenBoletaPagoDto {
  @ApiPropertyOptional({ example: 2026, description: 'Gestión (año). Por defecto, la actual.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La gestión debe ser un número entero.' })
  @Min(2000, { message: 'La gestión no es válida.' })
  gestion?: number;

  @ApiPropertyOptional({ example: 9, description: 'Mes (1-12). Por defecto, el actual.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El mes debe ser un número entero.' })
  @Min(1, { message: 'El mes debe estar entre 1 y 12.' })
  @Max(12, { message: 'El mes debe estar entre 1 y 12.' })
  mes?: number;
}
