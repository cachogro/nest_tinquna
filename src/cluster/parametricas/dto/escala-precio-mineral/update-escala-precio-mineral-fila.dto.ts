import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  Min,
} from 'class-validator';

export class UpdateEscalaPrecioMineralFilaDto {
  @IsNotEmpty({ message: 'El id del tramo es obligatorio para actualizar.' })
  @Type(() => Number)
  @IsPositive({ message: 'El id del tramo no es válido.' })
  id: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 4 },
    { message: 'La ley debe ser un número válido.' },
  )
  @Min(0, { message: 'La ley no puede ser negativa.' })
  ley?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 5 },
    { message: 'El precio por punto debe ser un número válido.' },
  )
  @Min(0, { message: 'El precio por punto no puede ser negativo.' })
  precioPunto?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 5 },
    { message: 'El precio por tonelada métrica debe ser un número válido.' },
  )
  @Min(0, { message: 'El precio por tonelada métrica no puede ser negativo.' })
  precioTm?: number;

  @IsOptional()
  @IsDateString({}, { message: 'La fecha de vigencia inicial no tiene un formato válido.' })
  fechaVigenciaInicial?: string;

  @IsOptional()
  @IsDateString({}, { message: 'La fecha de vigencia final no tiene un formato válido.' })
  fechaVigenciaFinal?: string;
}
