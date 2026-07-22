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
import { ApiProperty } from '@nestjs/swagger';

export class CreateUsuarioDto {
  @ApiProperty({
    description: 'ID del usuario (opcional, se genera automáticamente si no se envía)',
    example: 'usr-123',
    required: false,
  })
  @IsString()
  @IsOptional()
  id?: string;

  @ApiProperty({
    description: 'Nombre de usuario (único)',
    example: 'jperez',
    minLength: 4,
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty({ message: 'El nombre de usuario es obligatorio' })
  @MinLength(4, { message: 'El usuario debe tener al menos 4 caracteres' })
  @MaxLength(50)
  usuario: string;

  @ApiProperty({
    description: 'Contraseña (mínimo 6 caracteres)',
    example: 'MiClaveSegura2024',
    minLength: 6,
    maxLength: 60,
    writeOnly: true, // Oculta en las respuestas
  })
  @IsString()
  @IsNotEmpty({ message: 'La contraseña es obligatoria' })
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  @MaxLength(60)
  contrasena: string;

  @ApiProperty({
    description: 'ID del rol asignado al usuario',
    example: 'rol-admin',
  })
  @IsString()
  @IsNotEmpty({ message: 'El ID del rol inicial es obligatorio' })
  idRol: string;

  @ApiProperty({
    description: 'Datos de la persona asociada al usuario',
    type: () => CreatePersonaDto, // Referencia al DTO anidado
  })
  @IsObject()
  @ValidateNested()
  @Type(() => CreatePersonaDto)
  persona: CreatePersonaDto;
}
