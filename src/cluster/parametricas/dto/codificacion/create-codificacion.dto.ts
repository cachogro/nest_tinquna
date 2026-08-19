import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateCodificacionDto {
  @IsString()
  @IsOptional()
  id: string;

  @IsString()
  @IsNotEmpty({ message: 'El código es obligatorio' })
  @MinLength(2, {
    message: 'El código debe tener al menos 2 caracteres',
  })
  @MaxLength(15, {
    message: 'El código no puede superar los 15 caracteres',
  })
  codigo: string;

  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MinLength(3, {
    message: 'El nombre debe tener al menos 3 caracteres',
  })
  @MaxLength(100, {
    message: 'El nombre no puede superar los 100 caracteres',
  })
  nombre: string;

  @IsArray({
    message: 'Los minerales deben enviarse en un arreglo',
  })
  @ArrayNotEmpty({
    message: 'Debe seleccionar al menos un mineral',
  })
  @ArrayUnique({
    message: 'No puede repetir minerales',
  })
  @Type(() => Number)
  @IsInt({
    each: true,
    message: 'Cada mineral debe ser un identificador válido',
  })
  minerales: number[];
}