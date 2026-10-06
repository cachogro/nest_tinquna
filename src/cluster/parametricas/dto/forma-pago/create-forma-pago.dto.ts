import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export class CreateFormaPagoDto {
  @ApiProperty({
    example: 'TARJETA',
    description:
      'Código único de la forma de pago (mayúsculas, números y guion bajo). No se puede cambiar después de registrada.',
  })
  @IsString({
    message: 'El código debe ser una cadena de texto.',
  })
  @IsNotEmpty({
    message: 'El código es obligatorio.',
  })
  @Length(2, 20, {
    message: 'El código debe tener entre 2 y 20 caracteres.',
  })
  @Matches(/^[A-Za-z0-9_]+$/, {
    message: 'El código solo admite letras, números y guion bajo.',
  })
  codigo: string;

  @ApiProperty({
    example: 'TARJETA DE DEBITO',
    description: 'Nombre de la forma de pago.',
  })
  @IsString({
    message: 'El nombre debe ser una cadena de texto.',
  })
  @IsNotEmpty({
    message: 'El nombre es obligatorio.',
  })
  @Length(2, 40, {
    message: 'El nombre debe tener entre 2 y 40 caracteres.',
  })
  nombre: string;

  @ApiProperty({
    example: true,
    description:
      'TRUE = mueve caja o banco. FALSE = movimiento interno (descuentos, tranzado).',
    required: false,
    default: true,
  })
  @IsOptional()
  @IsBoolean({
    message: 'afectaFondo debe ser verdadero o falso.',
  })
  afectaFondo?: boolean;
}
