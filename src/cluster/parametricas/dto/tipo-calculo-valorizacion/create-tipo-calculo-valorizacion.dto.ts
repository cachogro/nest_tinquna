import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  Length,
} from 'class-validator';

export class CreateTipoCalculoValorizacionDto {
  @ApiProperty({
    example: 'MAQUILA',
    description: 'Descripción del tipo de cálculo (única en el catálogo).',
  })
  @IsString({ message: 'La descripción debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'La descripción es obligatoria.' })
  @Length(2, 100, {
    message: 'La descripción debe tener entre 2 y 100 caracteres.',
  })
  descripcion: string;

  @ApiProperty({
    example: 1,
    description: 'Agrupador del cálculo: 1 = gastos de tratamiento, 2 = penalidades.',
  })
  @IsNotEmpty({ message: 'El tipo de cálculo es obligatorio.' })
  @Type(() => Number)
  @IsInt({ message: 'El tipo de cálculo debe ser un número entero.' })
  @IsPositive({ message: 'El tipo de cálculo no es válido.' })
  idTipoCalculo: number;

  @ApiPropertyOptional({
    description:
      'Configuración de referencia del cálculo (ej. base/unidad/escalador para gastos de tratamiento, o cada/cargo/leyLibre para penalidades).',
    example: { cada: 0.1, cargo: 2.5, leyLibre: 0.4, unidadLey: '%', unidadCargo: 'USD/TMS' },
  })
  @IsOptional()
  @IsObject()
  extras?: Record<string, any>;
}
