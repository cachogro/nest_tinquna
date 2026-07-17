import { Type } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsPositive } from 'class-validator';
import { CreateIngenioDto } from './create-ingenio.dto';

export class UpdateIngenioDto extends CreateIngenioDto {
  @IsOptional()
  @Type(() => Number)
  @IsPositive({
    message: 'El identificador del ingenio no es válido.',
  })
  id?: number;
}