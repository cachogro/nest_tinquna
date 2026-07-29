import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsPositive } from 'class-validator';
import { CreateLaboratorioDto } from './create-laboratorio.dto';

export class UpdateLaboratorioDto extends CreateLaboratorioDto {
  @ApiProperty({
    example: 1,
    description: 'Identificador del laboratorio.',
  })
  @Type(() => Number)
  @IsPositive({
    message: 'El identificador no es válido.',
  })
  id: number;
}