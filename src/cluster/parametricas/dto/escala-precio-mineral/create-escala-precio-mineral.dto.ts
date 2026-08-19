import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  ValidateNested,
} from 'class-validator';
import { CreateEscalaPrecioMineralFilaDto } from './create-escala-precio-mineral-fila.dto';

export class CreateEscalaPrecioMineralDto {
  @IsNotEmpty({ message: 'El mineral es obligatorio.' })
  @Type(() => Number)
  @IsPositive({ message: 'El mineral seleccionado no es válido.' })
  idMineral: number;

  @IsNotEmpty({ message: 'La fecha de vigencia inicial es obligatoria.' })
  @IsDateString({}, { message: 'La fecha de vigencia inicial no tiene un formato válido.' })
  fechaVigenciaInicial: string;

  @IsOptional()
  @IsDateString({}, { message: 'La fecha de vigencia final no tiene un formato válido.' })
  fechaVigenciaFinal?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Debe enviar al menos un tramo de ley.' })
  @ArrayUnique((fila: CreateEscalaPrecioMineralFilaDto) => fila.ley, {
    message: 'No puede repetir la misma ley dentro de la misma carga.',
  })
  @ValidateNested({ each: true })
  @Type(() => CreateEscalaPrecioMineralFilaDto)
  filas: CreateEscalaPrecioMineralFilaDto[];
}
