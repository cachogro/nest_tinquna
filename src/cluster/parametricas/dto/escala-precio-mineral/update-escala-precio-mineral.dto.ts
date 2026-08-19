import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { UpdateEscalaPrecioMineralFilaDto } from './update-escala-precio-mineral-fila.dto';

export class UpdateEscalaPrecioMineralDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Debe enviar al menos un tramo a actualizar.' })
  @ValidateNested({ each: true })
  @Type(() => UpdateEscalaPrecioMineralFilaDto)
  filas: UpdateEscalaPrecioMineralFilaDto[];
}
