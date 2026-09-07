import { ApiProperty } from '@nestjs/swagger';
import { PaginadoResponseDto } from 'src/common/dto/paginado-response.dto';
import { Kardex } from '../../entities/kardex.entity';

export class KardexPaginadoDto extends PaginadoResponseDto<Kardex> {
  @ApiProperty({
    type: () => [Kardex],
  })
  declare data: Kardex[];
}
