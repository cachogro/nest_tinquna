import {
  IsNotEmpty,
  IsString,
} from 'class-validator';
import { CreateCodificacionDto } from './create-codificacion.dto';

export class UpdateCodificacionDto extends CreateCodificacionDto {
  @IsString()
  @IsNotEmpty({ message: 'El identificador es obligatorio.' })
  override id: string = '';
}
