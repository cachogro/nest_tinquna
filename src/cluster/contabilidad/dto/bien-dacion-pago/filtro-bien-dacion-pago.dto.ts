import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class FiltroBienDacionPagoDto {
  @ApiPropertyOptional({ example: '20', description: 'Filtrar por persona.' })
  @IsOptional()
  @IsString()
  idPersona?: string;

  @ApiPropertyOptional({ example: '4', description: 'Filtrar por actor productivo minero.' })
  @IsOptional()
  @IsString()
  idActorProductivoMinero?: string;

  @ApiPropertyOptional({
    enum: ['EN_POSESION', 'VENDIDO', 'DEVUELTO'],
    description: 'Filtrar por estado.',
  })
  @IsOptional()
  @IsIn(['EN_POSESION', 'VENDIDO', 'DEVUELTO'])
  estado?: 'EN_POSESION' | 'VENDIDO' | 'DEVUELTO';

  @ApiPropertyOptional({ example: '2026-01-01', description: 'Fecha de recepción inicial (YYYY-MM-DD), inclusive.' })
  @IsOptional()
  @IsString()
  fechaDesde?: string;

  @ApiPropertyOptional({ example: '2026-12-31', description: 'Fecha de recepción final (YYYY-MM-DD), inclusive.' })
  @IsOptional()
  @IsString()
  fechaHasta?: string;

  @Type(() => Number)
  @IsOptional()
  page?: number;

  @Type(() => Number)
  @IsOptional()
  limit?: number;
}
