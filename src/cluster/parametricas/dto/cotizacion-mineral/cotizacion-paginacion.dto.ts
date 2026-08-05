import { ApiProperty } from '@nestjs/swagger';
import { PaginadoResponseDto } from 'src/common/dto/paginado-response.dto';
import { CotizacionMineral } from '../../entities/cotizacion-mineral.entity';

export class CotizacionesPaginadasDto extends PaginadoResponseDto<CotizacionMineral> {
  @ApiProperty({
    type: () => [CotizacionMineral],
  })
  declare data: CotizacionMineral[];
}
