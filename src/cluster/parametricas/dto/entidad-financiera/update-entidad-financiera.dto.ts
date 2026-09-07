import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsPositive } from 'class-validator';
import { CreateEntidadFinancieraDto } from './create-entidad-financiera.dto';

/**
 * Cuerpo único del `POST /parametricas/entidad-financiera`:
 * sin `id` registra, con `id` actualiza.
 */
export class UpdateEntidadFinancieraDto extends CreateEntidadFinancieraDto {
  @ApiPropertyOptional({
    example: 3,
    description: 'Identificador de la entidad financiera.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsPositive({
    message: 'El identificador de la entidad financiera no es válido.',
  })
  id?: number;
}
