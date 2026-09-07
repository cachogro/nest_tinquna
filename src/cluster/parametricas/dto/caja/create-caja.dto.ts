import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';

export class CreateCajaDto {
  @ApiProperty({
    example: 'CAJA PRINCIPAL',
    description: 'Nombre de la caja. Se guarda en mayúsculas y debe ser único.',
  })
  @IsString({ message: 'El nombre debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'El nombre es obligatorio.' })
  @Length(3, 80, { message: 'El nombre debe tener entre 3 y 80 caracteres.' })
  nombre: string;

  @ApiPropertyOptional({
    example: 1587523,
    description: 'Saldo con el que arranca la caja en bolivianos.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El saldo inicial en Bs. debe ser numérico con hasta 2 decimales.' },
  )
  @Min(0, { message: 'El saldo inicial en Bs. no puede ser negativo.' })
  saldoInicialBob?: number;

  @ApiPropertyOptional({
    example: '2025-06-30',
    description: 'Fecha del saldo inicial en bolivianos (YYYY-MM-DD).',
  })
  @IsOptional()
  @IsDateString({}, { message: 'La fecha debe tener el formato YYYY-MM-DD.' })
  fechaSaldoInicialBob?: string;

  @ApiPropertyOptional({
    example: 0,
    description: 'Saldo con el que arranca la caja en dólares.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El saldo inicial en $us. debe ser numérico con hasta 2 decimales.' },
  )
  @Min(0, { message: 'El saldo inicial en $us. no puede ser negativo.' })
  saldoInicialUsd?: number;

  @ApiPropertyOptional({
    example: '2025-06-30',
    description: 'Fecha del saldo inicial en dólares (YYYY-MM-DD).',
  })
  @IsOptional()
  @IsDateString({}, { message: 'La fecha debe tener el formato YYYY-MM-DD.' })
  fechaSaldoInicialUsd?: string;
}
