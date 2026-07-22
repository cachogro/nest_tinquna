import { ApiProperty, PartialType } from '@nestjs/swagger';

import { IsString, IsOptional, IsNumber, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreatePersonaDto } from '../create-persona.dto';

// 1. Creamos el DTO parcial para la Persona
export class UpdatePersonaDto extends PartialType(CreatePersonaDto) {}

// 2. Creamos el DTO principal para el Usuario
export class UpdateUsuarioDto {
  @ApiProperty({
    description: 'Nuevo nombre de usuario (si se desea cambiar)',
    example: 'jperez_nuevo',
    required: false,
    minLength: 4,
    maxLength: 50,
  })
  @IsString()
  @IsOptional()
  usuario?: string;

  @ApiProperty({
    description: 'Nueva contraseña (si se desea cambiar)',
    example: 'NuevaClave2024',
    required: false,
    minLength: 6,
    maxLength: 60,
    writeOnly: true,
  })
  @IsString()
  @IsOptional()
  contrasena?: string;

  @ApiProperty({
    description: 'ID del nuevo rol a asignar (si se desea cambiar)',
    example: 'rol-gerente',
    required: false,
  })
  @IsString()
  @IsOptional()
  idRol?: string;

  @ApiProperty({
    description: 'Datos parciales de la persona asociada (si se desea actualizar)',
    type: () => UpdatePersonaDto, // Referencia al DTO anidado
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdatePersonaDto)
  persona?: UpdatePersonaDto;
}
