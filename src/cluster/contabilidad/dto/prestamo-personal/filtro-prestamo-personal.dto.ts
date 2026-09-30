import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class FiltroPrestamoPersonalDto {
  @ApiPropertyOptional({ example: '18', description: 'Filtrar por persona.' })
  @IsOptional()
  @IsString()
  idPersona?: string;

  @ApiPropertyOptional({ enum: ['VIGENTE', 'CANCELADO'], description: 'Filtrar por estado.' })
  @IsOptional()
  @IsIn(['VIGENTE', 'CANCELADO'])
  estado?: 'VIGENTE' | 'CANCELADO';

  @Type(() => Number)
  @IsOptional()
  page?: number;

  @Type(() => Number)
  @IsOptional()
  limit?: number;
}
