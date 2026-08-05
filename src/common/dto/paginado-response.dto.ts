import { ApiProperty } from '@nestjs/swagger';

/**
 * Shape común de todas las respuestas de listados paginados del proyecto.
 * Cada DTO de respuesta de un módulo extiende esta clase y solo redeclara
 * `data` con su propio `@ApiProperty({ type: () => [X] })`, porque Swagger
 * no puede inferir el tipo genérico en tiempo de ejecución.
 */
export abstract class PaginadoResponseDto<T> {
  data: T[];

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
