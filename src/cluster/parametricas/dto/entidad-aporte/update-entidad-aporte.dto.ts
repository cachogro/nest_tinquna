import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsPositive } from 'class-validator';
import { CreateEntidadAporteDto } from './create-entidad-aporte.dto';

export class UpdateEntidadAporteDto extends CreateEntidadAporteDto {
  @ApiProperty({
    example: 6,
    description: 'Identificador de la entidad de aporte.',
  })
  @Type(() => Number)
  @IsPositive({
    message: 'El identificador no es válido.',
  })
  id: number;
}
