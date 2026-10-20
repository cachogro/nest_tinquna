import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';

export class CreatePersonaTipoDto {
  @ApiProperty({
    example: 'PROVEEDOR',
    description:
      'Nombre del tipo o rol de persona. Se guarda siempre en mayúsculas y debe ser único.',
  })
  @IsString({ message: 'El nombre debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'El nombre es obligatorio.' })
  @Length(3, 50, { message: 'El nombre debe tener entre 3 y 50 caracteres.' })
  nombre: string;
}
