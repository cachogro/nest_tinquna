import { ApiProperty } from '@nestjs/swagger';
import { PaginadoResponseDto } from 'src/common/dto/paginado-response.dto';
import { Recibo } from '../../entities/recibo.entity';

export class ReciboPaginadoDto extends PaginadoResponseDto<Recibo> {
  @ApiProperty({
    type: () => [Recibo],
  })
  declare data: Recibo[];
}
