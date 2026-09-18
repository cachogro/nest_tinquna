import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, Max, Min } from 'class-validator';

/**
 * A diferencia de `FiltroMovimientoCajaDto` (donde gestión/mes son
 * opcionales para listar todo), el Excel imprime un único mes del libro
 * físico: gestión y período son obligatorios.
 */
export class FiltroCajaFlujoExcelDto {
  @ApiProperty({ example: 1, description: 'Id de la caja (obligatorio).' })
  @Type(() => Number)
  @IsInt({ message: 'La caja no es válida.' })
  idCaja: number;

  @ApiProperty({
    enum: ['BOB', 'USD'],
    example: 'BOB',
    description: 'Moneda a exportar (obligatorio: el saldo corriente se calcula por moneda).',
  })
  @IsIn(['BOB', 'USD'], { message: 'La moneda debe ser BOB o USD.' })
  moneda: 'BOB' | 'USD';

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
