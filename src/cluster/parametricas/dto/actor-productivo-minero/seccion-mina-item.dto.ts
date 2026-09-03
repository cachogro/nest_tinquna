import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SeccionMinaItemDto {
  @Type(() => Number)
  @IsInt({
    message: 'El id de la sección minera debe ser un número entero.',
  })
  id: number;

  @IsNotEmpty({
    message: 'La descripción de la sección minera es obligatoria.',
  })
  @IsString({
    message: 'La descripción de la sección minera debe ser una cadena de texto.',
  })
  @MaxLength(100, {
    message: 'La descripción de la sección minera no puede exceder los 100 caracteres.',
  })
  descripcion: string;
}
