import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * Cuerpo del `POST /contabilidad/fondo-rendir/:id/reponer`: le devuelve al
 * destinatario el excedente de un fondo RENDIDO_EN_EXCESO. Genera un recibo
 * de EGRESO real por `montoPorReponer` (no se envía el monto: siempre es
 * todo lo que falta reponer), con el mismo criterio de caja/banco que la
 * entrega del fondo.
 */
export class ReponerFondoRendirDto {
  @ApiProperty({ example: '2026-10-02', description: 'Fecha de la devolución (YYYY-MM-DD).' })
  @IsDateString({}, { message: 'La fecha debe tener el formato YYYY-MM-DD.' })
  fecha: string;

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
      'Id de la cuenta bancaria, si se devuelve por un medio bancario (obligatorio en ese caso, junto con nroComprobante). Sin esto, sale de la caja de flujo en efectivo.',
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
    example: 13,
    description:
      'Id del destino del gasto de la devolución. Si se omite se usa el de la cabecera del fondo.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive({ message: 'El destino del gasto no es válido.' })
  idDestinoGasto?: number;

  @ApiProperty({
    example: '7',
    description:
      'Id de la persona (persona_ci) que AUTORIZÓ la devolución (debe estar `autorizado = true` y activa). Igual que en un recibo.',
  })
  @IsNotEmpty({ message: 'Debe indicar quién autorizó la devolución (idPersonaAutorizo).' })
  @IsString({ message: 'El id de la persona que autorizó debe ser una cadena de texto.' })
  idPersonaAutorizo: string;
}
