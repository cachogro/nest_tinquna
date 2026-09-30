import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';

export class CreateCodificacionLoteDto {
  @ApiProperty({
    example: 'MC',
    description:
      'Código de la codificación del lote. Es el prefijo del código del lote (MC-0001).',
  })
  @IsString({ message: 'El código debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'El código es obligatorio.' })
  @Length(1, 10, { message: 'El código debe tener entre 1 y 10 caracteres.' })
  codigo: string;

  @ApiProperty({
    example: 'EXPORTACION',
    description: 'Nombre de la codificación del lote.',
  })
  @IsString({ message: 'El nombre debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'El nombre es obligatorio.' })
  @Length(3, 100, { message: 'El nombre debe tener entre 3 y 100 caracteres.' })
  nombre: string;
}
