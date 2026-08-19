import { Type } from 'class-transformer';
import { IsOptional, IsPositive } from 'class-validator';
import { CreateActorProductivoMineroDto } from './create-actor-productivo-minero.dto';

export class UpdateActorProductivoMineroDto extends CreateActorProductivoMineroDto {
  @IsOptional()
  @Type(() => Number)
  @IsPositive({
    message: 'El identificador del actor productivo minero no es válido.',
  })
  id?: number;
}
