import { ApiProperty } from '@nestjs/swagger';
import { PaginadoResponseDto } from 'src/common/dto/paginado-response.dto';
import { UsuarioListadoDto } from './usuario-listado.dto';

export class UsuariosPaginadosDto extends PaginadoResponseDto<UsuarioListadoDto> {
  @ApiProperty({
    type: () => [UsuarioListadoDto],
  })
  declare data: UsuarioListadoDto[];
}
