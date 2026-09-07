import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * Cuerpo único del `POST /contabilidad/movimiento-kardex`:
 * sin `id` registra una línea; con `id` la actualiza.
 * El `saldo` no se envía: lo calcula el servicio.
 */
export class CreateMovimientoKardexDto {
  @ApiPropertyOptional({
    description: 'Id del movimiento. Presente => actualizar; ausente => crear.',
    example: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive({ message: 'El id del movimiento no es válido.' })
  id?: number;

  @ApiProperty({ example: '3', description: 'Id del kardex (debe estar ABIERTO).' })
  @IsString({ message: 'El kardex no es válido.' })
  @IsNotEmpty({ message: 'El kardex es obligatorio.' })
  idKardex: string;

  @ApiProperty({ example: '2026-01-16', description: 'Fecha del movimiento (YYYY-MM-DD).' })
  @IsDateString({}, { message: 'La fecha debe tener el formato YYYY-MM-DD.' })
  fecha: string;

  @ApiPropertyOptional({
    example: 'REC:C-273',
    description: 'N° de comprobante / documento.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(30, { message: 'El N° de comprobante no puede exceder los 30 caracteres.' })
  nroComprobante?: string;

  @ApiProperty({
    example: 'ANTICIPO A CTA COMPRESORA',
    description: 'Detalle del movimiento.',
  })
  @IsString({ message: 'El detalle debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'El detalle es obligatorio.' })
  @MaxLength(255, { message: 'El detalle no puede exceder los 255 caracteres.' })
  detalle: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'Id de la subcuenta (parametrica.kardex_subcuenta): "Principal", "Compresora"...',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive({ message: 'La subcuenta no es válida.' })
  idSubcuenta?: number;

  @ApiPropertyOptional({
    example: 1,
    description: 'Id de la forma de pago (parametrica.forma_pago).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive({ message: 'La forma de pago no es válida.' })
  idFormaPago?: number;

  @ApiPropertyOptional({
    example: 8,
    description: 'Id del destino del gasto (parametrica.destino_gasto).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive({ message: 'El destino del gasto no es válido.' })
  idDestinoGasto?: number;

  @ApiPropertyOptional({
    example: '20',
    description: 'Id de la persona (persona_ci) que recibió / entregó físicamente.',
  })
  @IsOptional()
  @IsString()
  idCobrador?: string;

  @ApiPropertyOptional({
    example: '42',
    description: 'Id de la valorización de mineral cuando el movimiento nace de tranzarla.',
  })
  @IsOptional()
  @IsString()
  idValorizacion?: string;

  @ApiProperty({
    enum: ['DEBE', 'HABER'],
    example: 'DEBE',
    description: 'DEBE = anticipo entregado (sube la deuda). HABER = pago / descuento (la baja).',
  })
  @IsIn(['DEBE', 'HABER'], {
    message: 'El tipo debe ser DEBE (anticipo) o HABER (pago/descuento).',
  })
  tipo: 'DEBE' | 'HABER';

  @ApiProperty({ example: 960, description: 'Monto del movimiento (mayor a 0).' })
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El monto debe ser numérico con hasta 2 decimales.' },
  )
  @IsPositive({ message: 'El monto debe ser mayor a 0.' })
  monto: number;
}
