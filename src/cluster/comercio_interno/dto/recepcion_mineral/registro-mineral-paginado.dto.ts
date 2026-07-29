import { ApiProperty } from '@nestjs/swagger';
import { RecepcionMineral } from '../../entities/recepcion_mineral/recepcion-mineral.entity';


export class RegistrosMineralPaginadosDto {
  @ApiProperty({
    type: () => [RecepcionMineral],
    description: 'Listado de registros de recepción de mineral.',
  })
  data: RecepcionMineral[];

  @ApiProperty({
    example: 125,
    description: 'Cantidad total de registros encontrados.',
  })
  total: number;

  @ApiProperty({
    example: 1,
    description: 'Página actual.',
  })
  page: number;

  @ApiProperty({
    example: 10,
    description: 'Cantidad de registros por página.',
  })
  limit: number;

  @ApiProperty({
    example: 13,
    description: 'Total de páginas.',
  })
  totalPages: number;
}