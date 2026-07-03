import { ApiProperty, PartialType } from '@nestjs/swagger';

import { IsString, IsOptional, IsNumber, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreatePersonaDto } from '../create-persona.dto';

// 1. Creamos el DTO parcial para la Persona
export class UpdatePersonaDto extends PartialType(CreatePersonaDto) {}

// 2. Creamos el DTO principal para el Usuario
export class UpdateUsuarioDto {
  @ApiProperty({ description: 'Nuevo nombre de usuario', required: false })
  @IsString()
  @IsOptional()
  usuario?: string;

  @ApiProperty({ description: 'Nueva contraseña', required: false })
  @IsString()
  @IsOptional()
  contrasena?: string;

  @ApiProperty({ description: 'ID del nuevo Rol a asignar', required: false })
  @IsString()
  @IsOptional()
  idRol?: string;

  @ApiProperty({ description: 'Datos parciales de la persona a modificar', required: false, type: UpdatePersonaDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdatePersonaDto)
  persona?: UpdatePersonaDto;
}
