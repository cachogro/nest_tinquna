import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

/**
 * Listado paginado de las líneas de un kardex (de persona, actor o cliente):
 * solo paginación, sin filtros ni ordenamiento configurable (siempre la
 * última línea primero).
 */
export class FiltroMovimientoKardexDto {
  @ApiProperty({ example: '3', description: 'Id del kardex (obligatorio).' })
  @IsString({ message: 'El kardex no es válido.' })
  @IsNotEmpty({ message: 'El kardex es obligatorio.' })
  idKardex: string;

  @ApiPropertyOptional({ description: 'Número de página.', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ description: 'Cantidad de registros por página.', example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit = 10;
}
