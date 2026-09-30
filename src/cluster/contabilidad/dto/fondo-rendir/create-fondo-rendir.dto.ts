import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * Cuerpo del `POST /contabilidad/fondo-rendir`: entrega un fondo a rendir
 * cuentas. Genera, en el mismo paso, el recibo de EGRESO real que mueve la
 * plata (efectivo -> caja; medio bancario -> libreta de bancos, mismo
 * criterio que un recibo común) y la cabecera del fondo (estado PENDIENTE).
 * El destinatario es una persona O un actor productivo minero (excluyentes).
 */
export class CreateFondoRendirDto {
  @ApiPropertyOptional({
    example: '20',
    description:
      'Id de la persona (persona_ci) destinataria del fondo. Excluyente con idActorProductivoMinero (uno de los dos es obligatorio).',
  })
  @IsOptional()
  @IsString({ message: 'El id de la persona debe ser una cadena de texto.' })
  idPersona?: string;

  @ApiPropertyOptional({
    example: '4',
    description:
      'Id del actor productivo minero destinatario del fondo. Excluyente con idPersona (uno de los dos es obligatorio).',
  })
  @IsOptional()
  @IsString({ message: 'El id del actor productivo minero debe ser una cadena de texto.' })
  idActorProductivoMinero?: string;

  @ApiProperty({ example: '2026-09-23', description: 'Fecha de entrega (YYYY-MM-DD).' })
  @IsDateString({}, { message: 'La fecha debe tener el formato YYYY-MM-DD.' })
  fecha: string;

  @ApiProperty({
    example: 'ADELANTO PARA COMPRA DE MATERIALES',
    description: 'Concepto de la entrega (se usa también como concepto del recibo de egreso).',
  })
  @IsString({ message: 'El concepto debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'El concepto es obligatorio.' })
  @MaxLength(255, { message: 'El concepto no puede exceder los 255 caracteres.' })
  concepto: string;

  @ApiProperty({ example: 100, description: 'Monto entregado (mayor a 0).' })
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El monto debe ser numérico con hasta 2 decimales.' },
  )
  @IsPositive({ message: 'El monto debe ser mayor a 0.' })
  monto: number;

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
      'Id de la cuenta bancaria, si se entregó por un medio bancario (obligatorio en ese caso, junto con nroComprobante). Sin esto, la entrega sale de la caja de flujo en efectivo.',
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
      'Id del destino del gasto (parametrica.destino_gasto) que clasifica esta entrega en los reportes.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive({ message: 'El destino del gasto no es válido.' })
  idDestinoGasto?: number;

  @ApiProperty({
    example: '7',
    description:
      'Id de la persona (persona_ci) que AUTORIZÓ la entrega (debe estar `autorizado = true` y activa). Igual que en un recibo.',
  })
  @IsNotEmpty({ message: 'Debe indicar quién autorizó la entrega (idPersonaAutorizo).' })
  @IsString({ message: 'El id de la persona que autorizó debe ser una cadena de texto.' })
  idPersonaAutorizo: string;

  @ApiPropertyOptional({
    example: '2026-10-07',
    description: 'Fecha esperada de rendición (solo informativa, para alertar fondos vencidos).',
  })
  @IsOptional()
  @IsDateString({}, { message: 'La fecha límite debe tener el formato YYYY-MM-DD.' })
  fechaLimite?: string;
}
