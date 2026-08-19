import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsPositive } from 'class-validator';
import { CreateTipoCalculoValorizacionDto } from './create-tipo-calculo-valorizacion.dto';

export class UpdateTipoCalculoValorizacionDto extends CreateTipoCalculoValorizacionDto {
  @ApiProperty({
    example: 3,
    description: 'Identificador del tipo de cálculo a actualizar.',
  })
  @Type(() => Number)
  @IsPositive({ message: 'El identificador no es válido.' })
  id: number;
}
