import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** Acuerdo de nueva tasa: recalcula TODAS las cuotas pendientes del plan. */
export class CambiarTasaKardexInteresDto {
  @ApiProperty({
    example: 1.5,
    description: 'Nueva tasa MENSUAL (%). Se aplica a todos los meses pendientes y a los siguientes.',
  })
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 4 },
    { message: 'La tasa mensual debe ser numérica con hasta 4 decimales.' },
  )
  @Min(0.0001, { message: 'La tasa mensual debe ser mayor a 0. Para no cobrar intereses, condoná.' })
  @Max(100, { message: 'La tasa mensual no puede superar el 100 %.' })
  tasaMensual: number;

  @ApiProperty({
    example: 'ACUERDO CON GERENCIA: SE BAJA AL 1.5 %',
    description: 'Motivo del acuerdo / quién lo autorizó.',
  })
  @IsString({ message: 'La observación debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'Indicá el motivo del cambio de tasa.' })
  @MaxLength(500, { message: 'La observación no puede exceder los 500 caracteres.' })
  observacion: string;
}
