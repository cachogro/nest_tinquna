import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';

export class CreateRecepcionMineralDetalleDto {
  @IsNotEmpty({
    message: 'El mineral es obligatorio.',
  })
  @Type(() => Number)
  @IsPositive({
    message: 'El mineral seleccionado no es válido.',
  })
  idMineral: number;

  @IsNotEmpty({
    message: 'La ley es obligatoria.',
  })
  @Type(() => Number)
  @IsNumber(
    {
      maxDecimalPlaces: 4,
    },
    {
      message: 'La ley debe ser un valor numérico con hasta 4 decimales.',
    },
  )
  @Min(0, {
    message: 'La ley no puede ser menor a cero.',
  })
  ley: number;

  @ApiProperty({
    description: 'Referencia a la ley unidad, es opcional',
  })
  @IsString({ message: 'descripcion debe ser una cadena de caracteres.' })
  leyUnidad?: string;
}
