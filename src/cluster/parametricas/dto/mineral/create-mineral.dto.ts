import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';

export class CreateMineralDto {
  @ApiProperty({
    example: 'PLATA',
    description: 'Descripción o nombre del mineral.',
  })
  @IsString({
    message: 'La descripción debe ser una cadena de texto.',
  })
  @IsNotEmpty({
    message: 'La descripción es obligatoria.',
  })
  @Length(2, 100, {
    message: 'La descripción debe tener entre 2 y 100 caracteres.',
  })
  descripcion: string;

  @ApiProperty({
    example: 'Ag',
    description: 'Símbolo químico del mineral.',
  })
  @IsString({
    message: 'El símbolo debe ser una cadena de texto.',
  })
  @IsNotEmpty({
    message: 'El símbolo es obligatorio.',
  })
  @Length(1, 20, {
    message: 'El símbolo debe tener entre 1 y 20 caracteres.',
  })
  simbolo: string;

  @ApiProperty({
    example: 'Oz.Tr.',
    description: 'Unidad en la que se cotiza el mineral.',
  })
  @IsString({
    message: 'La unidad de cotización debe ser una cadena de texto.',
  })
  @IsNotEmpty({
    message: 'La unidad de cotización es obligatoria.',
  })
  @Length(1, 50, {
    message: 'La unidad de cotización debe tener entre 1 y 50 caracteres.',
  })
  unidadCotizacion: string;

  @ApiProperty({
    example: 'Mineral de plata',
    description: 'Detalle o descripción ampliada del mineral.',
  })
  @IsString({
    message: 'El detalle del mineral debe ser una cadena de texto.',
  })
  @IsNotEmpty({
    message: 'El detalle del mineral es obligatorio.',
  })
  @Length(2, 200, {
    message: 'El detalle del mineral debe tener entre 2 y 200 caracteres.',
  })
  detalleMineral: string;

  @ApiProperty({
    example: 31.1035,
    description: 'Factor de conversión del mineral.',
  })
  @Type(() => Number)
  @IsNumber(
    {},
    {
      message: 'El factor de conversión debe ser un número.',
    },
  )
  factorConversion: number;

  @ApiProperty({
    example: 'METALICO',
    description: 'Tipo de mineral.',
  })
  @IsString({
    message: 'El tipo debe ser una cadena de texto.',
  })
  @IsNotEmpty({
    message: 'El tipo es obligatorio.',
  })
  @Length(2, 50, {
    message: 'El tipo debe tener entre 2 y 50 caracteres.',
  })
  tipo: string;

  @ApiProperty({
    example: 4.5,
    description: 'Alícuota externa del mineral.',
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 5 },
    { message: 'La alícuota externa debe ser un número válido con máximo 5 decimales.' },
  )
  @Min(0, { message: 'La alícuota externa no puede ser negativa.' })
  alicuotaExterna?: number;

  @ApiProperty({
    example: 3.2,
    description: 'Alícuota interna del mineral.',
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 5 },
    { message: 'La alícuota interna debe ser un número válido con máximo 5 decimales.' },
  )
  @Min(0, { message: 'La alícuota interna no puede ser negativa.' })
  alicuotaInterna?: number;
}
