import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsNumber, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';
import { DatosPagoDto } from '../prestamo-personal/datos-pago.dto';

/**
 * Cuerpo del `POST /contabilidad/bien-dacion-pago/:id/vender`. El precio
 * entra DIRECTO a la caja de flujo (efectivo) o a la libreta de bancos (con
 * cuenta bancaria), sin recibo; los datos de pago dicen por dónde.
 *
 * Venta directa (bien EN_POSESION): además abona `montoAmortizar` al kardex
 * del dueño. Bien TOMADO_EN_PAGO: el kardex ya se abonó al tomarlo, así que
 * `montoAmortizar` se ignora.
 */
export class VenderBienDacionPagoDto extends DatosPagoDto {
  @ApiProperty({ example: '2026-10-10', description: 'Fecha de la venta (YYYY-MM-DD).' })
  @IsDateString({}, { message: 'La fecha debe tener el formato YYYY-MM-DD.' })
  fechaVenta: string;

  @ApiProperty({ example: 5100, description: 'Precio por el que se vendió el bien (mayor a 0).' })
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El monto de venta debe ser numérico con hasta 2 decimales.' },
  )
  @IsPositive({ message: 'El monto de venta debe ser mayor a 0.' })
  montoVenta: number;

  @ApiPropertyOptional({
    example: 5000,
    description:
      'Solo en venta directa (bien EN_POSESION): cuánto de la deuda del dueño se amortiza (HABER en su kardex). Si se omite, es el valor acordado, o el precio de venta si se vendió por menos. La diferencia con el precio es ganancia (o pérdida) de la empresa y no toca el kardex.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El monto a amortizar debe ser numérico con hasta 2 decimales.' },
  )
  @IsPositive({ message: 'El monto a amortizar debe ser mayor a 0.' })
  montoAmortizar?: number;

  @ApiPropertyOptional({
    example: 'VENDIDO A JUAN PEREZ.',
    description: 'Observaciones libres sobre la venta (reemplaza las anteriores si se envía).',
  })
  @IsOptional()
  @IsString({ message: 'Las observaciones deben ser una cadena de texto.' })
  @MaxLength(500, { message: 'Las observaciones no pueden exceder los 500 caracteres.' })
  observaciones?: string;
}
