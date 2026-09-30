import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateVentaLoteDto {
  @ApiProperty({ example: '12', description: 'Promedio (lote) que se vende entero.' })
  @IsString({ message: 'El promedio debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'El promedio es obligatorio.' })
  idPromedioMineral: string;

  @ApiProperty({
    example: '3',
    description: 'Cliente comprador. Debe tener un kardex CLIENTE abierto (ahí van sus anticipos).',
  })
  @IsString({ message: 'El cliente debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'El cliente es obligatorio.' })
  idCliente: string;

  @ApiProperty({ example: '2026-09-29', description: 'Fecha de la venta (YYYY-MM-DD).' })
  @IsDateString({}, { message: 'La fecha de venta debe tener el formato YYYY-MM-DD.' })
  fechaVenta: string;

  @ApiPropertyOptional({
    enum: ['BS', 'USD'],
    default: 'BS',
    description: 'BS = comercio interno; USD = exportación.',
  })
  @IsOptional()
  @IsIn(['BS', 'USD'], { message: 'La moneda debe ser BS o USD.' })
  moneda?: 'BS' | 'USD';

  @ApiPropertyOptional({
    example: 6.96,
    description: 'Tipo de cambio de referencia (Bs. por 1 USD). Obligatorio en USD.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 }, { message: 'El tipo de cambio debe tener hasta 4 decimales.' })
  @IsPositive({ message: 'El tipo de cambio debe ser mayor a 0.' })
  tipoCambio?: number;

  @ApiPropertyOptional({ example: 'ENTREGA EN ORURO' })
  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'Las observaciones no pueden exceder los 255 caracteres.' })
  observaciones?: string;
}

/** Solo datos que no afectan montos ya cobrados. */
export class UpdateVentaLoteDto {
  @ApiPropertyOptional({ example: '2026-09-29' })
  @IsOptional()
  @IsDateString({}, { message: 'La fecha de venta debe tener el formato YYYY-MM-DD.' })
  fechaVenta?: string;

  @ApiPropertyOptional({ example: 6.96 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 }, { message: 'El tipo de cambio debe tener hasta 4 decimales.' })
  @IsPositive({ message: 'El tipo de cambio debe ser mayor a 0.' })
  tipoCambio?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'Las observaciones no pueden exceder los 255 caracteres.' })
  observaciones?: string;
}

export class LiquidarVentaLoteDto {
  @ApiProperty({
    example: 850000,
    description: 'Monto NETO de la liquidación del comprador, en la moneda de la venta.',
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El monto debe tener hasta 2 decimales.' })
  @IsPositive({ message: 'El monto de la liquidación debe ser mayor a 0.' })
  montoVenta: number;

  @ApiPropertyOptional({
    example: 6.96,
    description: 'Tipo de cambio de la liquidación. Obligatorio si la venta es en USD.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 }, { message: 'El tipo de cambio debe tener hasta 4 decimales.' })
  @IsPositive({ message: 'El tipo de cambio debe ser mayor a 0.' })
  tipoCambio?: number;

  @ApiProperty({ example: '2026-10-20', description: 'Fecha de la liquidación (YYYY-MM-DD).' })
  @IsDateString({}, { message: 'La fecha de liquidación debe tener el formato YYYY-MM-DD.' })
  fechaLiquidacion: string;
}

export class FiltroVentaLoteDto {
  @ApiPropertyOptional({ description: 'Busca por código de lote, código de promedio o cliente.' })
  @IsOptional()
  @IsString()
  busqueda?: string;

  @ApiPropertyOptional({ enum: ['ABIERTA', 'LIQUIDADA', 'ANULADA'] })
  @IsOptional()
  @IsIn(['ABIERTA', 'LIQUIDADA', 'ANULADA'])
  estado?: 'ABIERTA' | 'LIQUIDADA' | 'ANULADA';

  @ApiPropertyOptional({ example: '3' })
  @IsOptional()
  @IsString()
  idCliente?: string;

  @Type(() => Number)
  @IsOptional()
  page?: number;

  @Type(() => Number)
  @IsOptional()
  limit?: number;
}

export class FiltroPromediosDisponiblesVentaDto {
  @ApiPropertyOptional({ description: 'Código de lote o de promedio.' })
  @IsOptional()
  @IsString()
  busqueda?: string;
}
