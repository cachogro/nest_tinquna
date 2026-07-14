import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { CreateRecepcionMineralDto } from './create-recepcion-mineral.dto';

export class UpdateRecepcionMineralDto extends CreateRecepcionMineralDto {
  @ApiPropertyOptional({
    description: 'Identificador de la recepción.',
    example: '25',
  })
  @IsOptional()
  @IsString()
  id?: string;
}