import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsPositive } from 'class-validator';
import { CreateMineralDto } from './create-mineral.dto';

export class UpdateMineralDto extends CreateMineralDto {
  @ApiProperty({
    example: 1,
    description: 'Identificador del mineral.',
  })
  @Type(() => Number)
  @IsPositive({
    message: 'El identificador no es válido.',
  })
  id: number;
}
