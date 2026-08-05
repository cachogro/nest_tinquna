import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';
import { DetalleAporteDto } from './detalle-aporte.dto';

export class CreateEntidadAporteDto {
  @ApiProperty({
    example: 'FERRECO',
    description: 'Descripción o nombre de la entidad de aporte.',
  })
  @IsString({
    message: 'La descripción debe ser una cadena de texto.',
  })
  @IsNotEmpty({
    message: 'La descripción es obligatoria.',
  })
  @Length(3, 120, {
    message: 'La descripción debe tener entre 3 y 120 caracteres.',
  })
  descripcion: string;

  @ApiProperty({
    type: [DetalleAporteDto],
    description: 'Configuración de alícuota(s) y base de cálculo del aporte.',
    example: [{ alicuota: 0.35, tipoBaseAporte: 'VBV' }],
  })
  @IsArray({
    message: 'El detalle de aporte debe enviarse en un arreglo.',
  })
  @ArrayNotEmpty({
    message: 'Debe registrar al menos un detalle de aporte.',
  })
  @ValidateNested({ each: true })
  @Type(() => DetalleAporteDto)
  detalleAporte: DetalleAporteDto[];

  @ApiProperty({
    example: 1,
    description: 'Identificador del tipo de entidad de aporte.',
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsPositive({
    message: 'El tipo de entidad de aporte seleccionado no es válido.',
  })
  idTipoEntidadAporte?: number;
}
