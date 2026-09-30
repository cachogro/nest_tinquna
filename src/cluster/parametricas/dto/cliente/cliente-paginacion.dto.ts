import { ApiProperty } from '@nestjs/swagger';
import { PaginadoResponseDto } from 'src/common/dto/paginado-response.dto';
import { Cliente } from '../../entities/cliente.entity';

export class ClientesPaginadosDto extends PaginadoResponseDto<Cliente> {
  @ApiProperty({
    type: () => [Cliente],
  })
  declare data: Cliente[];
}
