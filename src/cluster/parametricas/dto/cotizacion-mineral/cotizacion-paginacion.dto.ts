import { ApiProperty } from '@nestjs/swagger';
import { CotizacionMineral } from '../../entities/cotizacion-mineral.entity';


export class CotizacionesPaginadasDto {
  @ApiProperty({
    type: () => [CotizacionMineral],
  })
  data: CotizacionMineral[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;
}