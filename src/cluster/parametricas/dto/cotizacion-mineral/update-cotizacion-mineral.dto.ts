import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  Min,
} from 'class-validator';

export class UpdateCotizacionMineralDto {
  @IsNotEmpty({ message: 'El identificador de la cotización es obligatorio para actualizar.' })
  @Type(() => Number)
  @IsPositive({ message: 'El identificador de la cotización no es válido.' })
  id: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 5 },
    { message: 'La cotización debe ser un número válido con máximo 5 decimales.' }
  )
  @Min(0, { message: 'La cotización no puede ser negativa.' })
  cotizacionMineralDolares?: number;

  @IsOptional()
  @IsDateString({}, { message: 'La fecha de vigencia final no tiene un formato válido.' })
  fechaVigenciaFinal?: Date;
}