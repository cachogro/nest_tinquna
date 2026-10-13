import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * Un medio de un pago MIXTO (por ejemplo, la mitad en efectivo y el resto
 * por QR o transferencia). Se envía una lista en `pagos`: la suma de sus
 * montos debe ser igual al total que se paga. Efectivo mueve la caja de
 * flujo; un medio bancario, la libreta de la cuenta indicada.
 */
export class MedioPagoDto {
  @ApiProperty({ example: 1, description: 'Id de la forma de pago de este medio.' })
  @Type(() => Number)
  @IsInt()
  @IsPositive({ message: 'La forma de pago no es válida.' })
  idFormaPago: number;

  @ApiProperty({ example: 500, description: 'Monto que se paga por este medio (> 0, hasta 2 decimales).' })
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El monto de cada medio de pago debe tener hasta 2 decimales.' },
  )
  @IsPositive({ message: 'El monto de cada medio de pago debe ser mayor a 0.' })
  monto: number;

  @ApiPropertyOptional({
    example: 1,
    description: 'Obligatoria si la forma de pago es bancaria (QR, Transferencia, Cheque, Depósito).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive({ message: 'La cuenta bancaria no es válida.' })
  idCuentaBancaria?: number;

  @ApiPropertyOptional({
    example: '4613159797',
    description: 'N° de la transacción bancaria. Obligatorio si la forma de pago es bancaria.',
  })
  @IsOptional()
  @IsString({ message: 'El N° de comprobante debe ser una cadena de texto.' })
  @MaxLength(30, { message: 'El N° de comprobante no puede exceder los 30 caracteres.' })
  nroComprobante?: string;
}
