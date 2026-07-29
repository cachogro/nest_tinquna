import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

export class CreateLaboratorioDto {
  @ApiProperty({
    example: 'Laboratorio Químico Potosí',
    description: 'Nombre del laboratorio.',
  })
  @IsString({
    message: 'El nombre debe ser una cadena de texto.',
  })
  @IsNotEmpty({
    message: 'El nombre es obligatorio.',
  })
  @Length(3, 100, {
    message: 'El nombre debe tener entre 3 y 100 caracteres.',
  })
  nombre: string;

  @ApiProperty({
    example: 'Av. Universitaria N° 123',
    description: 'Dirección del laboratorio.',
    required: false,
  })
  @IsOptional()
  @IsString({
    message: 'La dirección debe ser una cadena de texto.',
  })
  @Length(3, 200, {
    message: 'La dirección debe tener entre 3 y 200 caracteres.',
  })
  direccion?: string;

  @ApiProperty({
    example: '62451234',
    description: 'Número telefónico.',
    required: false,
  })
  @IsOptional()
  @IsString({
    message: 'El teléfono debe ser una cadena de texto.',
  })
  @Length(6, 20, {
    message: 'El teléfono debe tener entre 6 y 20 caracteres.',
  })
  telefono?: string;
}
