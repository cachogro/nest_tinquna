import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

import { FormatoReporteDto } from '../reporte/formato-reporte.dto';

/**
 * Filtro del Excel "RENDICIÓN DE CUENTAS": un destinatario (persona o
 * actor, excluyentes) + una gestión. Con `mes` genera el reporte mensual de
 * ese mes; sin `mes`, el anual (los 12 meses de la gestión).
 */
export class FiltroFondoRendirExcelDto extends FormatoReporteDto {
  @ApiPropertyOptional({ example: '20', description: 'Id de la persona destinataria.' })
  @IsOptional()
  @IsString()
  idPersona?: string;

  @ApiPropertyOptional({ example: '4', description: 'Id del actor productivo minero destinatario.' })
  @IsOptional()
  @IsString()
  idActorProductivoMinero?: string;

  @ApiProperty({ example: 2026, description: 'Gestión (año).' })
  @Type(() => Number)
  @IsInt()
  gestion: number;

  @ApiPropertyOptional({
    example: 3,
    description: 'Mes (1-12). Si se omite, el reporte es ANUAL (toda la gestión).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  mes?: number;
}
