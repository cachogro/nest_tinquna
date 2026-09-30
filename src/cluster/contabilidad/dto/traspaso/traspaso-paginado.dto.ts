import { ApiProperty } from '@nestjs/swagger';
import { PaginadoResponseDto } from 'src/common/dto/paginado-response.dto';
import { Traspaso } from '../../entities/traspaso.entity';

export class TraspasoPaginadoDto extends PaginadoResponseDto<Traspaso> {
  @ApiProperty({
    type: () => [Traspaso],
  })
  declare data: Traspaso[];
}
