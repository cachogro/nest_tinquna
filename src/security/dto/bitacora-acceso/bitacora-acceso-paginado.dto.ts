import { ApiProperty } from '@nestjs/swagger';
import { PaginadoResponseDto } from 'src/common/dto/paginado-response.dto';
import { BitacoraAcceso } from '../../entities/bitacora-acceso.entity';

export class BitacoraAccesoPaginadaDto extends PaginadoResponseDto<BitacoraAcceso> {
  @ApiProperty({
    type: () => [BitacoraAcceso],
  })
  declare data: BitacoraAcceso[];
}
