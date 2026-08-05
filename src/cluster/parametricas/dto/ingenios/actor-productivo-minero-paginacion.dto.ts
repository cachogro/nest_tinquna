import { ApiProperty } from '@nestjs/swagger';
import { PaginadoResponseDto } from 'src/common/dto/paginado-response.dto';
import { ActorProductivoMinero } from '../../entities/actor-productivo-minero.entity';

export class ActoresProductivosMinerosPaginadosDto extends PaginadoResponseDto<ActorProductivoMinero> {
  @ApiProperty({
    type: () => [ActorProductivoMinero],
  })
  declare data: ActorProductivoMinero[];
}
