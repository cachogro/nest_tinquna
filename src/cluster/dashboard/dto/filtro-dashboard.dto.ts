import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class FiltroDashboardDto {
  @ApiPropertyOptional({
    example: '2026-09-01',
    description: 'Inicio del período (YYYY-MM-DD). Sin valor: primer día del mes actual.',
  })
  @IsOptional()
  @IsDateString({}, { message: 'fechaDesde debe tener el formato YYYY-MM-DD.' })
  fechaDesde?: string;

  @ApiPropertyOptional({
    example: '2026-09-30',
    description: 'Fin del período (YYYY-MM-DD, inclusive). Sin valor: hoy.',
  })
  @IsOptional()
  @IsDateString({}, { message: 'fechaHasta debe tener el formato YYYY-MM-DD.' })
  fechaHasta?: string;
}
