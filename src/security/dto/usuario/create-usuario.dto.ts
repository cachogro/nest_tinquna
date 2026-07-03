import {
  IsString,
  MinLength,
  MaxLength,
  IsNotEmpty,
  IsOptional,
  ValidateNested,
  IsInt,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreatePersonaDto } from '../create-persona.dto';

export class CreateUsuarioDto {
  @IsString()
  @IsOptional()
  id: string;

  @IsString()
  @IsNotEmpty({ message: 'El nombre de usuario es obligatorio' })
  @MinLength(4, { message: 'El usuario debe tener al menos 4 caracteres' })
  @MaxLength(50)
  usuario: string;

  @IsString()
  @IsNotEmpty({ message: 'La contraseña es obligatoria' })
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  @MaxLength(60)
  contrasena: string;

  @IsString()
  @IsNotEmpty({ message: 'El ID del rol inicial es obligatorio' })
  idRol: string;

  // Objeto anidado obligatorio con los datos de la persona
  @IsObject()
  @ValidateNested()
  @Type(() => CreatePersonaDto)
  persona: CreatePersonaDto;
}
