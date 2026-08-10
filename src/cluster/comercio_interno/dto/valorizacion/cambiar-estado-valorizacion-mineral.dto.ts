import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

/**
 * DTO para PATCH /comercio_interno/valorizacion_mineral/:id/estado
 *
 * Endpoint dedicado exclusivamente al cambio de estado de la valorización.
 * El front indica a qué estado está pasando: PRE-VALORIZADO (2) o VALORIZADO (3).
 */
export class CambiarEstadoValorizacionMineralDto {
  @ApiProperty({
    description:
      'Id del nuevo estado de la valorización (parametrica.estado_valorizacion). ' +
      '2 = PRE-VALORIZADO, 3 = VALORIZADO.',
    example: 3,
    enum: [2, 3],
  })
  @IsIn([2, 3])
  idEstadoValorizacion: number;
}
