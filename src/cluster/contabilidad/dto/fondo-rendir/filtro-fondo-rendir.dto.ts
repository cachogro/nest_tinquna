import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class FiltroFondoRendirDto {
  @ApiPropertyOptional({ example: '20', description: 'Filtrar por persona destinataria.' })
  @IsOptional()
  @IsString()
  idPersona?: string;

  @ApiPropertyOptional({ example: '4', description: 'Filtrar por actor productivo minero destinatario.' })
  @IsOptional()
  @IsString()
  idActorProductivoMinero?: string;

  @ApiPropertyOptional({
    enum: ['PENDIENTE', 'RENDIDO_PARCIAL', 'RENDIDO_TOTAL', 'RENDIDO_EN_EXCESO', 'CERRADO_CON_DEUDA'],
    description: 'Filtrar por estado.',
  })
  @IsOptional()
  @IsIn(['PENDIENTE', 'RENDIDO_PARCIAL', 'RENDIDO_TOTAL', 'RENDIDO_EN_EXCESO', 'CERRADO_CON_DEUDA'])
  estado?:
    | 'PENDIENTE'
    | 'RENDIDO_PARCIAL'
    | 'RENDIDO_TOTAL'
    | 'RENDIDO_EN_EXCESO'
    | 'CERRADO_CON_DEUDA';

  @ApiPropertyOptional({ example: '2026-01-01', description: 'Fecha inicial (YYYY-MM-DD), inclusive.' })
  @IsOptional()
  @IsString()
  fechaDesde?: string;

  @ApiPropertyOptional({ example: '2026-12-31', description: 'Fecha final (YYYY-MM-DD), inclusive.' })
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
