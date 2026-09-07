import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsPositive } from 'class-validator';
import { CreateCajaDto } from './create-caja.dto';

/**
 * Se usa como cuerpo único del `POST /parametricas/caja`:
 * sin `id` registra, con `id` actualiza.
 */
export class UpdateCajaDto extends CreateCajaDto {
  @ApiPropertyOptional({
    example: 1,
    description: 'Identificador de la caja. Si se envía, se actualiza; si no, se crea.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsPositive({ message: 'El identificador de la caja no es válido.' })
  id?: number;
}
