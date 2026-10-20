import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class FiltroBoletaPagoDto {
  @ApiPropertyOptional({ example: '18', description: 'Filtrar por persona.' })
  @IsOptional()
  @IsString()
  idPersona?: string;

  @ApiPropertyOptional({
    enum: ['SUELDO', 'AGUINALDO', 'FINIQUITO', 'RETROACTIVO'],
    description: 'Filtrar por tipo de boleta. Sin filtro, todas.',
  })
  @IsOptional()
  @IsIn(['SUELDO', 'AGUINALDO', 'FINIQUITO', 'RETROACTIVO'], {
    message: 'El tipo debe ser SUELDO, AGUINALDO, FINIQUITO o RETROACTIVO.',
  })
  tipo?: 'SUELDO' | 'AGUINALDO' | 'FINIQUITO' | 'RETROACTIVO';

  @ApiPropertyOptional({ example: '2026-01-01', description: 'Fecha de pago inicial (YYYY-MM-DD), inclusive.' })
  @IsOptional()
  @IsString()
  fechaDesde?: string;

  @ApiPropertyOptional({ example: '2026-12-31', description: 'Fecha de pago final (YYYY-MM-DD), inclusive.' })
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
