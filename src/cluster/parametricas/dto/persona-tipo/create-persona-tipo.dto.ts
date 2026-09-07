import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class CreatePersonaTipoDto {
  @ApiProperty({
    example: 'PROV',
    description:
      'Código del tipo de persona. Se guarda siempre en mayúsculas y debe ser único.',
  })
  @IsString({ message: 'El código debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'El código es obligatorio.' })
  @Length(2, 20, { message: 'El código debe tener entre 2 y 20 caracteres.' })
  codigo: string;

  @ApiProperty({
    example: 'PROVEEDOR',
    description: 'Nombre del tipo de persona. Se guarda siempre en mayúsculas.',
  })
  @IsString({ message: 'El nombre debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'El nombre es obligatorio.' })
  @Length(3, 50, { message: 'El nombre debe tener entre 3 y 50 caracteres.' })
  nombre: string;

  @ApiPropertyOptional({
    example: 'PERSONA QUE ENTREGA MINERAL A LA EMPRESA',
    description: 'Descripción del tipo de persona. Se guarda en mayúsculas.',
  })
  @IsOptional()
  @IsString({ message: 'La descripción debe ser una cadena de texto.' })
  @MaxLength(150, {
    message: 'La descripción no puede exceder los 150 caracteres.',
  })
  descripcion?: string;
}
