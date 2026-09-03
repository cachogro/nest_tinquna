import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  Min,
} from 'class-validator';

export class CreateCotizacionMineralDto {
  @IsNotEmpty({ message: 'El mineral es obligatorio.' })
  @Type(() => Number)
  @IsPositive({ message: 'El mineral seleccionado no es válido.' })
  idMineral: number;

  @IsNotEmpty({ message: 'La cotización del mineral es obligatoria.' })
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 5 },
    { message: 'La cotización debe ser un número válido con máximo 5 decimales.' }
  )
  @Min(0, { message: 'La cotización no puede ser negativa.' })
  cotizacionMineralDolares: number;

  @IsNotEmpty({ message: 'La fecha de vigencia final es obligatoria.' })
  @IsDateString({}, { message: 'La fecha de vigencia final no tiene un formato válido.' })
  fechaVigenciaFinal: Date;
}