import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { FormatoReporteDto } from '../reporte/formato-reporte.dto';

const TIPOS = ['SUELDO', 'AGUINALDO', 'FINIQUITO', 'RETROACTIVO'] as const;

/**
 * Query del `GET /contabilidad/boleta-pago/planilla` (y su Excel): mes por
 * fecha de pago. Sin gestion/mes, el mes actual.
 */
export class PlanillaMensualDto extends FormatoReporteDto {
  @ApiPropertyOptional({ example: 2026 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La gestión debe ser un número entero.' })
  @Min(2000, { message: 'La gestión no es válida.' })
  gestion?: number;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El mes debe ser un número entero.' })
  @Min(1, { message: 'El mes debe estar entre 1 y 12.' })
  @Max(12, { message: 'El mes debe estar entre 1 y 12.' })
  mes?: number;

  @ApiPropertyOptional({
    example: 'SUELDO,RETROACTIVO',
    description: 'Tipos de boleta separados por coma. Por defecto SUELDO,RETROACTIVO (las que cotizan).',
  })
  @IsOptional()
  @Transform(({ value }) =>
    Array.isArray(value)
      ? value
      : String(value)
          .split(',')
          .map((t) => t.trim().toUpperCase())
          .filter(Boolean),
  )
  @IsIn(TIPOS, { each: true, message: 'Los tipos deben ser SUELDO, AGUINALDO, FINIQUITO o RETROACTIVO.' })
  tipos?: (typeof TIPOS)[number][];
}
