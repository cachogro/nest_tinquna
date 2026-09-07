import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CuentaBancariaDto {
  @ApiPropertyOptional({
    description:
      'Id de la cuenta. Solo al actualizar una entidad: con id se modifica la cuenta existente, sin id se agrega una nueva.',
    example: 4,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El id de la cuenta debe ser un número entero.' })
  @IsPositive({ message: 'El id de la cuenta no es válido.' })
  id?: number;

  @ApiProperty({
    example: '1-2345678',
    description: 'Número de cuenta.',
  })
  @IsString({ message: 'El número de cuenta debe ser una cadena de texto.' })
  @MinLength(1, { message: 'El número de cuenta es obligatorio.' })
  @MaxLength(40, {
    message: 'El número de cuenta no puede exceder los 40 caracteres.',
  })
  numeroCuenta: string;

  @ApiProperty({
    example: 'BOB',
    enum: ['BOB', 'USD'],
    description: 'Moneda de la cuenta.',
  })
  @IsIn(['BOB', 'USD'], { message: 'La moneda debe ser BOB o USD.' })
  moneda: string;

  @ApiPropertyOptional({
    example: 'Operativa Bs',
    description: 'Alias corto para elegir la cuenta en el front.',
  })
  @IsOptional()
  @IsString({ message: 'El alias debe ser una cadena de texto.' })
  @MaxLength(60, { message: 'El alias no puede exceder los 60 caracteres.' })
  alias?: string;

  @ApiPropertyOptional({
    example: 13510.03,
    description:
      'Saldo exacto con el que arranca la libreta de bancos de esta cuenta. Debe cargarse antes de registrar movimientos.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El saldo inicial debe ser numérico con hasta 2 decimales.' },
  )
  @Min(0, { message: 'El saldo inicial no puede ser negativo.' })
  saldoInicial?: number;

  @ApiPropertyOptional({
    example: '2025-05-01',
    description: 'Fecha del saldo inicial (YYYY-MM-DD).',
  })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'La fecha del saldo inicial debe tener el formato YYYY-MM-DD.' },
  )
  fechaSaldoInicial?: string;
}
