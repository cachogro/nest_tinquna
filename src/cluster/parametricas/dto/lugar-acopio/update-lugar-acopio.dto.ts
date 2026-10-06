import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsPositive } from 'class-validator';
import { CreateLugarAcopioDto } from './create-lugar-acopio.dto';

export class UpdateLugarAcopioDto extends CreateLugarAcopioDto {
  @ApiProperty({
    example: 1,
    description: 'Identificador del lugar de acopio.',
  })
  @Type(() => Number)
  @IsPositive({
    message: 'El identificador no es válido.',
  })
  id: number;
}
