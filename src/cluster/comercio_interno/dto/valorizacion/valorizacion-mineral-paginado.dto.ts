import { ApiProperty } from '@nestjs/swagger';
import { PaginadoResponseDto } from 'src/common/dto/paginado-response.dto';
import { ValorizacionMineral } from '../../entities/valorizacion/valorizacion-mineral.entity';

export class ValorizacionesMineralPaginadasDto extends PaginadoResponseDto<ValorizacionMineral> {
  @ApiProperty({
    type: () => [ValorizacionMineral],
    description: 'Listado de valorizaciones de mineral.',
  })
  declare data: ValorizacionMineral[];
}
