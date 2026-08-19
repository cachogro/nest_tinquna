import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateActorProductivoMineroDto {
  @IsNotEmpty({
    message: 'El tipo de actor productivo minero es obligatorio.',
  })
  @Type(() => Number)
  @IsPositive({
    message: 'El tipo de actor productivo minero seleccionado no es válido.',
  })
  idTipoActorProductivoMinero: number;

  @IsNotEmpty({
    message: 'El nombre es obligatorio.',
  })
  @IsString({
    message: 'El nombre debe ser una cadena de texto.',
  })
  @MaxLength(150, {
    message: 'El nombre no puede exceder los 150 caracteres.',
  })
  nombre: string;

  @IsNotEmpty({
    message: 'La dirección es obligatoria.',
  })
  @IsString({
    message: 'La dirección debe ser una cadena de texto.',
  })
  @MaxLength(250, {
    message: 'La dirección no puede exceder los 250 caracteres.',
  })
  direccion: string;

  @IsOptional()
  @IsString({
    message: 'El teléfono debe ser una cadena de texto.',
  })
  @MaxLength(30, {
    message: 'El teléfono no puede exceder los 30 caracteres.',
  })
  telefono?: string;
}
