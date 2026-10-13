import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { MedioPagoDto } from '../medio-pago.dto';

/**
 * Datos del recibo que mueve la plata (préstamo, abono, boleta de pago):
 * mismo criterio que un recibo común — sin cuenta bancaria afecta la caja
 * de flujo en efectivo; con cuenta bancaria, la libreta de bancos.
 */
export abstract class DatosPagoDto {
  @ApiPropertyOptional({
    example: 1,
    description: 'Id de la forma de pago (Efectivo, QR, Transferencia, Cheque, Depósito...).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive({ message: 'La forma de pago no es válida.' })
  idFormaPago?: number;

  @ApiPropertyOptional({
    example: 1,
    description:
      'Id de la cuenta bancaria, si se paga por un medio bancario (obligatorio en ese caso, junto con nroComprobante). Sin esto, el movimiento va a la caja de flujo en efectivo.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive({ message: 'La cuenta bancaria no es válida.' })
  idCuentaBancaria?: number;

  @ApiPropertyOptional({
    example: '4478708896',
    description: 'N° de comprobante de la transacción bancaria, si corresponde.',
  })
  @IsOptional()
  @IsString({ message: 'El N° de comprobante debe ser una cadena de texto.' })
  @MaxLength(30, { message: 'El N° de comprobante no puede exceder los 30 caracteres.' })
  nroComprobante?: string;

  @ApiPropertyOptional({
    type: [MedioPagoDto],
    description:
      'Pago MIXTO: los medios por los que sale o entra el dinero (por ejemplo, la mitad en efectivo y el resto por QR). La suma de los montos debe ser igual a lo que mueve el recibo. Si se envía, reemplaza a `idFormaPago` / `idCuentaBancaria` / `nroComprobante`, que quedan con los datos del primer medio. Con un solo medio no hace falta: alcanza con esos tres campos.',
    example: [
      { idFormaPago: 1, monto: 500 },
      { idFormaPago: 2, monto: 500, idCuentaBancaria: 1, nroComprobante: '4613159797' },
    ],
  })
  @IsOptional()
  @IsArray({ message: 'Los medios de pago deben ser una lista.' })
  @ArrayMinSize(1, { message: 'Indicá al menos un medio de pago.' })
  @ValidateNested({ each: true })
  @Type(() => MedioPagoDto)
  pagos?: MedioPagoDto[];

  @ApiProperty({
    example: '7',
    description:
      'Id de la persona (persona_ci) que AUTORIZÓ la operación (debe estar `autorizado = true` y activa). Igual que en un recibo.',
  })
  @IsNotEmpty({ message: 'Debe indicar quién autorizó la operación (idPersonaAutorizo).' })
  @IsString({ message: 'El id de la persona que autorizó debe ser una cadena de texto.' })
  idPersonaAutorizo: string;

  @ApiPropertyOptional({
    example: 13,
    description:
      'Id del plan de cuentas (parametrica.plan_cuentas) que clasifica el movimiento de caja/banco en los reportes.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive({ message: 'El plan de cuentas no es válido.' })
  idPlanCuentas?: number;
}
