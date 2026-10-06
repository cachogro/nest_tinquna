import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsPositive } from 'class-validator';
import { CreateTipoCalculoValorizacionDto } from './create-tipo-calculo-valorizacion.dto';

/**
 * Se usa como cuerpo único del `POST /parametricas/tipo-calculo-valorizacion`:
 * sin `id` registra, con `id` actualiza.
 */
export class UpdateTipoCalculoValorizacionDto extends CreateTipoCalculoValorizacionDto {
  @ApiPropertyOptional({
    example: 3,
    description:
      'Identificador del tipo de cálculo. Si se envía, se actualiza; si no, se crea.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsPositive({ message: 'El identificador no es válido.' })
  id?: number;
}
