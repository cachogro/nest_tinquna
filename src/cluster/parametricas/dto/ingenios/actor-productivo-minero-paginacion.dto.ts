import { ApiProperty } from '@nestjs/swagger';
import { ActorProductivoMinero } from '../../entities/actor-productivo-minero.entity';

export class ActoresProductivosMinerosPaginadosDto {
  @ApiProperty({
    type: () => [ActorProductivoMinero],
  })
  data: ActorProductivoMinero[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;
}
