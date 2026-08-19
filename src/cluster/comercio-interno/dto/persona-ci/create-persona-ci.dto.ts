import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreatePersonaCiDto {
  @ApiProperty({
    description: 'Nombre(s) de la persona.',
    example: 'JUAN',
  })
  @IsString()
  @IsOptional({ message: 'El nombre es obligatorio.' })
  @MinLength(2, {
    message: 'El nombre debe tener al menos 2 caracteres.',
  })
  @MaxLength(100)
  nombres: string;

  @ApiPropertyOptional({
    description: 'Apellido paterno.',
    example: 'PÉREZ',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  apellidoPaterno?: string;

  @ApiPropertyOptional({
    description: 'Apellido materno.',
    example: 'MAMANI',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  apellidoMaterno?: string;

  @ApiPropertyOptional({
    description: 'Identificador del tipo de documento.',
    example: '1',
  })
  @IsOptional()
  @IsString()
  idTipoDocumento?: string;

  @ApiPropertyOptional({
    description: 'Número del documento de identidad.',
    example: '12345678',
  })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  numeroDocumento?: string;

  @ApiPropertyOptional({
    description: 'Número de celular.',
    example: '71234567',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  celular?: string;

  @ApiPropertyOptional({
    description: 'Observaciones adicionales.',
    example: 'Proveedor frecuente.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  observaciones?: string;

  @ApiProperty({
    description: 'Listado de tipos asociados a la persona.',
    example: [1],
    type: [Number],
  })
  @IsArray({
    message: 'Los tipos de persona deben enviarse en un arreglo.',
  })
  @ArrayNotEmpty({
    message: 'Debe seleccionar al menos un tipo de persona.',
  })
  tiposPersona: number[];

  @ApiProperty({
    description: 'ID del actor productivo minero asociado (opcional)',
    required: false,
    example: '123',
  })
  @IsOptional()
  @IsString()
  idActorProductivoMinero?: string;
}
