import { IsOptional, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateRecepcionMineralDto } from './create-recepcion-mineral.dto';

export class UpdateRecepcionMineralDto extends CreateRecepcionMineralDto {
  @IsOptional()
  @Type(() => Number)
  @IsPositive({
    message: 'El identificador de la recepción no es válido.',
  })
  id?: string;
}
