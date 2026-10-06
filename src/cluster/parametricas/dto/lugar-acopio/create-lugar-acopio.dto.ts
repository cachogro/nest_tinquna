import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';

export class CreateLugarAcopioDto {
  @ApiProperty({
    example: 'GALPON',
    description: 'Descripción del lugar de acopio.',
  })
  @IsString({
    message: 'La descripción debe ser una cadena de texto.',
  })
  @IsNotEmpty({
    message: 'La descripción es obligatoria.',
  })
  @Length(2, 100, {
    message: 'La descripción debe tener entre 2 y 100 caracteres.',
  })
  descripcion: string;
}
