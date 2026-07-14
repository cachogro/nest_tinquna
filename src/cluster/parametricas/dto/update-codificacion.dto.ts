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
import { CreateCodificacionDto } from './create-codificacion.dto';

export class UpdateCodificacionDto extends CreateCodificacionDto {
  @IsString()
  @IsNotEmpty({ message: 'El identificador es obligatorio.' })
  override id: string = '';
}
