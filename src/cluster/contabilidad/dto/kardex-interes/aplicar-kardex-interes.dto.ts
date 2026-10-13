import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** Aplica un interés mensual por mora al kardex (un solo plan VIGENTE a la vez). */
export class AplicarKardexInteresDto {
  @ApiProperty({
    example: 3,
    description: 'Porcentaje de interés MENSUAL sobre el saldo del kardex (3 = 3 % al mes).',
  })
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 4 },
    { message: 'La tasa mensual debe ser numérica con hasta 4 decimales.' },
  )
  @Min(0.0001, { message: 'La tasa mensual debe ser mayor a 0.' })
  @Max(100, { message: 'La tasa mensual no puede superar el 100 %.' })
  tasaMensual: number;

  @ApiPropertyOptional({
    example: '2026-07-01',
    description:
      'Desde cuándo corre el interés (YYYY-MM-DD). Por defecto, hoy. La primera cuota vence un mes después; si la fecha es pasada, se generan de una vez los meses ya cumplidos.',
  })
  @IsOptional()
  @IsDateString({}, { message: 'La fecha de inicio debe tener el formato YYYY-MM-DD.' })
  fechaInicio?: string;

  @ApiPropertyOptional({
    example: 'DEUDA EN MORA DESDE MARZO, AUTORIZADO POR GERENCIA',
    description: 'Motivo / quién lo autorizó.',
  })
  @IsOptional()
  @IsString({ message: 'Las observaciones deben ser una cadena de texto.' })
  @MaxLength(500, { message: 'Las observaciones no pueden exceder los 500 caracteres.' })
  observaciones?: string;
}
