import { ApiProperty } from '@nestjs/swagger';
import { UsuarioListadoDto } from './usuario-listado.dto';

export class UsuariosPaginadosDto {
  @ApiProperty({
    type: () => [UsuarioListadoDto],
  })
  data: UsuarioListadoDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;
}
