import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * Filtro del Excel consolidado de la caja de flujo (caja en Bs. y $us. más
 * todas las cuentas bancarias) de un único mes del libro físico.
 */
export class FiltroCajaConsolidadoExcelDto {
  @ApiPropertyOptional({
    example: 1,
    default: 1,
    description: 'Id de la caja. Por defecto 1 (CAJA PRINCIPAL).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La caja no es válida.' })
  idCaja?: number;

  @ApiProperty({ example: 2026, description: 'Año / gestión del período (obligatorio).' })
  @Type(() => Number)
  @IsInt({ message: 'La gestión debe ser un número entero.' })
  @Min(2000, { message: 'La gestión no es válida.' })
  @Max(2100, { message: 'La gestión no es válida.' })
  gestion: number;

  @ApiProperty({ example: 9, description: 'Mes del período, 1-12 (obligatorio).' })
  @Type(() => Number)
  @IsInt({ message: 'El mes debe ser un número entero.' })
  @Min(1, { message: 'El mes debe estar entre 1 y 12.' })
  @Max(12, { message: 'El mes debe estar entre 1 y 12.' })
  mes: number;
}
