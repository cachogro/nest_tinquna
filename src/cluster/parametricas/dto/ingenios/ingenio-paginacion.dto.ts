import { ApiProperty } from '@nestjs/swagger';
import { Ingenio } from '../../entities/ingenio.entity';


export class IngeniosPaginadosDto {
  @ApiProperty({
    type: () => [Ingenio],
  })
  data: Ingenio[];

  @ApiProperty({
    example: 100,
  })
  total: number;

  @ApiProperty({
    example: 1,
  })
  page: number;

  @ApiProperty({
    example: 10,
  })
  limit: number;

  @ApiProperty({
    example: 10,
  })
  totalPages: number;
}