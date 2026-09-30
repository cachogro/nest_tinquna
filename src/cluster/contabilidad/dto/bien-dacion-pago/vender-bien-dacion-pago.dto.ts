import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsNumber, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';
import { DatosPagoDto } from '../prestamo-personal/datos-pago.dto';

/**
 * Cuerpo del `POST /contabilidad/bien-dacion-pago/:id/vender`. Además de los
 * datos de la venta lleva los del recibo de INGRESO que se genera (forma de
 * pago, quién autorizó, etc.): el monto amortiza la deuda del dueño original
 * en su kardex y entra a la caja de flujo (o a la libreta, con cuenta
 * bancaria).
 */
export class VenderBienDacionPagoDto extends DatosPagoDto {
  @ApiProperty({ example: '2026-10-10', description: 'Fecha de la venta (YYYY-MM-DD).' })
  @IsDateString({}, { message: 'La fecha debe tener el formato YYYY-MM-DD.' })
  fechaVenta: string;

  @ApiProperty({ example: 48000, description: 'Monto por el que se vendió el bien (mayor a 0).' })
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El monto de venta debe ser numérico con hasta 2 decimales.' },
  )
  @IsPositive({ message: 'El monto de venta debe ser mayor a 0.' })
  montoVenta: number;

  @ApiPropertyOptional({
    example: 'VENDIDO A JUAN PEREZ.',
    description: 'Observaciones libres sobre la venta (reemplaza las anteriores si se envía).',
  })
  @IsOptional()
  @IsString({ message: 'Las observaciones deben ser una cadena de texto.' })
  @MaxLength(500, { message: 'Las observaciones no pueden exceder los 500 caracteres.' })
  observaciones?: string;
}
