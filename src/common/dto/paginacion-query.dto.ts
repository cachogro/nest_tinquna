import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Campos comunes a todos los listados paginados del proyecto. Cada DTO de
 * filtros de un módulo extiende esta clase y agrega únicamente sus propios
 * campos de filtro (activo, idRol, fechas, etc.) más su propio `orderBy`:
 * la lista de columnas válidas para ordenar es distinta en cada módulo, así
 * que `orderBy` se declara en cada subclase (con su propio `@IsIn([...])` y
 * su valor por defecto), no aquí.
 */
export abstract class PaginacionQueryDto {
  @ApiPropertyOptional({ description: 'Número de página.', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({
    description: 'Cantidad de registros por página.',
    example: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit = 10;

  @ApiPropertyOptional({ description: 'Texto de búsqueda libre.' })
  @IsOptional()
  @IsString()
  busqueda?: string;

  @ApiPropertyOptional({
    description: 'Dirección del ordenamiento.',
    enum: ['ASC', 'DESC'],
    default: 'DESC',
  })
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  orderDirection: 'ASC' | 'DESC' = 'DESC';
}
