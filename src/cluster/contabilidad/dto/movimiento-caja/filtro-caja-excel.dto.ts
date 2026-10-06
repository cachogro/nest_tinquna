import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

import { FormatoReporteDto } from '../reporte/formato-reporte.dto';

/**
 * Filtro de `GET movimiento-caja/excel`. Con `completo=true` sale el libro
 * consolidado (caja en Bs. y $us. más todas las cuentas bancarias) y la
 * caja es opcional; sin él, el Excel de una sola caja/moneda, donde caja y
 * moneda son obligatorias. En ambos casos se imprime un único mes.
 */
export class FiltroCajaExcelDto extends FormatoReporteDto {
  @ApiPropertyOptional({
    example: false,
    default: false,
    description: 'true = libro completo (caja + todas las cuentas bancarias).',
  })
  @IsOptional()
  // La conversión implícita vuelve true cualquier texto no vacío ("false" incluido).
  @Transform(
    ({ obj }: { obj: Record<string, unknown> }) =>
      obj.completo === true || obj.completo === 'true',
  )
  @IsBoolean({ message: 'completo debe ser true o false.' })
  completo?: boolean;

  @ApiPropertyOptional({
    example: 1,
    description:
      'Id de la caja. Obligatorio salvo con completo=true (ahí por defecto es la caja principal).',
  })
  @ValidateIf((o: FiltroCajaExcelDto) => !o.completo || o.idCaja != null)
  @Type(() => Number)
  @IsInt({ message: 'La caja no es válida.' })
  idCaja?: number;

  @ApiPropertyOptional({
    enum: ['BS', 'USD'],
    example: 'BS',
    description:
      'Moneda a exportar. Obligatoria salvo con completo=true (que trae las dos).',
  })
  @ValidateIf((o: FiltroCajaExcelDto) => !o.completo)
  @IsIn(['BS', 'USD'], { message: 'La moneda debe ser BS o USD.' })
  moneda?: 'BS' | 'USD';

  @ApiProperty({
    example: 2026,
    description: 'Año / gestión del período a imprimir (obligatorio).',
  })
  @Type(() => Number)
  @IsInt({ message: 'La gestión debe ser un número entero.' })
  @Min(2000, { message: 'La gestión no es válida.' })
  @Max(2100, { message: 'La gestión no es válida.' })
  gestion: number;

  @ApiProperty({
    example: 7,
    description: 'Mes del período a imprimir, 1-12 (obligatorio).',
  })
  @Type(() => Number)
  @IsInt({ message: 'El mes debe ser un número entero.' })
  @Min(1, { message: 'El mes debe estar entre 1 y 12.' })
  @Max(12, { message: 'El mes debe estar entre 1 y 12.' })
  mes: number;
}
