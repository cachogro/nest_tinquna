import { ApiProperty } from '@nestjs/swagger';
import { TipoCalculoValorizacion } from '../../entities/tipo-calculo-valorizacion.entity';

export class TipoCalculoValorizacionAgrupadoDto {
  @ApiProperty({
    description: 'Tipos de cálculo del grupo "gastos de tratamiento" (id_tipo_calculo = 1).',
    type: [TipoCalculoValorizacion],
  })
  gastos: TipoCalculoValorizacion[];

  @ApiProperty({
    description: 'Tipos de cálculo del grupo "penalidades" (id_tipo_calculo = 2).',
    type: [TipoCalculoValorizacion],
  })
  penalidades: TipoCalculoValorizacion[];
}
