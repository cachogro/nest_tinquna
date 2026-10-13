import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * Cuerpo único del `POST /contabilidad/talonario-cheque`:
 * sin `id` registra el talonario, con `id` lo actualiza.
 */
export class GuardarTalonarioChequeDto {
  @ApiPropertyOptional({
    description: 'Id del talonario. Presente => actualizar; ausente => crear.',
    example: 3,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive({ message: 'El id del talonario no es válido.' })
  id?: number;

  @ApiProperty({
    example: 1,
    description:
      'Id de la cuenta bancaria (parametrica.cuenta_bancaria). Debe tener habilitado el manejo de cheques. No se puede cambiar al actualizar.',
  })
  @Type(() => Number)
  @IsInt({ message: 'La cuenta bancaria no es válida.' })
  @IsPositive({ message: 'La cuenta bancaria no es válida.' })
  idCuentaBancaria: number;

  @ApiPropertyOptional({
    example: 'A',
    description: 'Serie impresa en la chequera, si el banco la usa.',
  })
  @IsOptional()
  @IsString({ message: 'La serie debe ser una cadena de texto.' })
  @MaxLength(20, { message: 'La serie no puede exceder los 20 caracteres.' })
  serie?: string;

  @ApiProperty({ example: 1001, description: 'Número del primer cheque del talonario.' })
  @Type(() => Number)
  @IsInt({ message: 'El número inicial debe ser un número entero.' })
  @IsPositive({ message: 'El número inicial debe ser mayor a cero.' })
  numeroInicial: number;

  @ApiProperty({
    example: 1050,
    description:
      'Número del último cheque del talonario. La cantidad de cheques es numeroFinal − numeroInicial + 1 (máximo 1000 por talonario).',
  })
  @Type(() => Number)
  @IsInt({ message: 'El número final debe ser un número entero.' })
  @IsPositive({ message: 'El número final debe ser mayor a cero.' })
  numeroFinal: number;

  @ApiProperty({
    example: '2026-10-06',
    description: 'Fecha en que el banco entregó el talonario (YYYY-MM-DD).',
  })
  @IsDateString(
    {},
    { message: 'La fecha de recepción debe tener el formato YYYY-MM-DD.' },
  )
  fechaRecepcion: string;

  @ApiPropertyOptional({
    example: '2027-10-06',
    description:
      'Vencimiento del talonario (YYYY-MM-DD). Opcional: por ley el talonario no vence; solo se carga si el banco lo fija.',
  })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'La fecha de vencimiento debe tener el formato YYYY-MM-DD.' },
  )
  fechaVencimiento?: string;

  @ApiPropertyOptional({ example: 'Entregado en agencia central.' })
  @IsOptional()
  @IsString({ message: 'La observación debe ser una cadena de texto.' })
  @MaxLength(255, {
    message: 'La observación no puede exceder los 255 caracteres.',
  })
  observacion?: string;
}

export class FiltroTalonarioChequeDto {
  @ApiPropertyOptional({
    example: 1,
    description: 'Solo los talonarios de esta cuenta bancaria.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La cuenta bancaria no es válida.' })
  @IsPositive({ message: 'La cuenta bancaria no es válida.' })
  idCuentaBancaria?: number;
}

export class FiltroChequeDto {
  @ApiPropertyOptional({ example: 1, description: 'Cheques de esta cuenta bancaria.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La cuenta bancaria no es válida.' })
  @IsPositive({ message: 'La cuenta bancaria no es válida.' })
  idCuentaBancaria?: number;

  @ApiPropertyOptional({ example: 3, description: 'Cheques de este talonario.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El talonario no es válido.' })
  @IsPositive({ message: 'El talonario no es válido.' })
  idTalonarioCheque?: number;

  @ApiPropertyOptional({ enum: ['EMITIDO', 'COBRADO', 'ANULADO'] })
  @IsOptional()
  @IsIn(['EMITIDO', 'COBRADO', 'ANULADO'], {
    message: 'El estado debe ser EMITIDO, COBRADO o ANULADO.',
  })
  estado?: 'EMITIDO' | 'COBRADO' | 'ANULADO';
}

export class CuentaChequeDto {
  @ApiProperty({ example: 1, description: 'Id de la cuenta bancaria.' })
  @Type(() => Number)
  @IsInt({ message: 'La cuenta bancaria no es válida.' })
  @IsPositive({ message: 'La cuenta bancaria no es válida.' })
  idCuentaBancaria: number;
}

export class CobrarChequeDto {
  @ApiProperty({
    example: '2026-10-10',
    description: 'Fecha en que el banco pagó el cheque (YYYY-MM-DD).',
  })
  @IsDateString(
    {},
    { message: 'La fecha de cobro debe tener el formato YYYY-MM-DD.' },
  )
  fechaCobro: string;
}

export class AnularChequeEnBlancoDto {
  @ApiProperty({ example: 3, description: 'Id del talonario.' })
  @Type(() => Number)
  @IsInt({ message: 'El talonario no es válido.' })
  @IsPositive({ message: 'El talonario no es válido.' })
  idTalonarioCheque: number;

  @ApiProperty({
    example: 1007,
    description: 'Número del cheque sin usar que se anula.',
  })
  @Type(() => Number)
  @IsInt({ message: 'El número de cheque debe ser un número entero.' })
  @IsPositive({ message: 'El número de cheque no es válido.' })
  numero: number;

  @ApiProperty({ example: 'Cheque dañado al llenarlo.' })
  @IsString({ message: 'El motivo debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'El motivo de la anulación es obligatorio.' })
  @MaxLength(255, { message: 'El motivo no puede exceder los 255 caracteres.' })
  motivo: string;
}
