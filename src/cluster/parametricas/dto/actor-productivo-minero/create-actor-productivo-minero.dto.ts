import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { SeccionMinaItemDto } from './seccion-mina-item.dto';

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

  @IsOptional()
  @Type(() => Number)
  @IsPositive({
    message: 'El municipio seleccionado no es válido.',
  })
  idMunicipio?: number;

  @IsOptional()
  @IsString({
    message: 'El NIM debe ser una cadena de texto.',
  })
  @MaxLength(20, {
    message: 'El NIM no puede exceder los 20 caracteres.',
  })
  nim?: string;

  @IsOptional()
  @IsString({
    message: 'El código debe ser una cadena de texto.',
  })
  @MaxLength(20, {
    message: 'El código no puede exceder los 20 caracteres.',
  })
  codigo?: string;

  @IsOptional()
  @IsArray({
    message: 'Las secciones mineras deben ser un arreglo.',
  })
  @ValidateNested({ each: true })
  @Type(() => SeccionMinaItemDto)
  seccionesMina?: SeccionMinaItemDto[];
}
