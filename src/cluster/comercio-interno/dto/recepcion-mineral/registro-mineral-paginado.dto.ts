import { ApiProperty } from '@nestjs/swagger';
import { PaginadoResponseDto } from 'src/common/dto/paginado-response.dto';
import { RecepcionMineral } from '../../entities/recepcion-mineral/recepcion-mineral.entity';

export class RegistrosMineralPaginadosDto extends PaginadoResponseDto<RecepcionMineral> {
  @ApiProperty({
    type: () => [RecepcionMineral],
    description: 'Listado de registros de recepción de mineral.',
  })
  declare data: RecepcionMineral[];
}
