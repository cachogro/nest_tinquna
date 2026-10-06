import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsPositive, IsString } from 'class-validator';

import { FormatoReporteDto } from '../reporte/formato-reporte.dto';

/**
 * Filtros del reporte Excel de traspasos. A diferencia del listado
 * (`FiltroTraspasoDto`) filtra por rango de fechas en vez de gestión, y
 * permite elegir moneda y estado (activos / desactivados). Todos son
 * opcionales: sin filtros sale el libro completo en orden cronológico.
 */
export class FiltroTraspasoExcelDto extends FormatoReporteDto {
  @ApiPropertyOptional({ example: 1, description: 'Filtrar por cuenta bancaria.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  idCuentaBancaria?: number;

  @ApiPropertyOptional({ enum: ['DEPOSITO', 'RETIRO'], description: 'Tipo de traspaso.' })
  @IsOptional()
  @IsIn(['DEPOSITO', 'RETIRO'], { message: 'El tipo debe ser DEPOSITO o RETIRO.' })
  tipo?: 'DEPOSITO' | 'RETIRO';

  @ApiPropertyOptional({
    enum: ['BS', 'USD'],
    description: 'Moneda del traspaso. Sin valor: ambas monedas (los totales salen por moneda).',
  })
  @IsOptional()
  @IsIn(['BS', 'USD'], { message: 'La moneda debe ser BS o USD.' })
  moneda?: 'BS' | 'USD';

  @ApiPropertyOptional({
    enum: ['ACTIVO', 'INACTIVO'],
    description: 'ACTIVO: vigentes; INACTIVO: desactivados. Sin valor: todos.',
  })
  @IsOptional()
  @IsIn(['ACTIVO', 'INACTIVO'], { message: 'El estado debe ser ACTIVO o INACTIVO.' })
  estado?: 'ACTIVO' | 'INACTIVO';

  @ApiPropertyOptional({ example: '2026-09-01', description: 'Fecha desde (YYYY-MM-DD).' })
  @IsOptional()
  @IsDateString({}, { message: 'La fecha desde debe tener el formato YYYY-MM-DD.' })
  fechaDesde?: string;

  @ApiPropertyOptional({ example: '2026-09-30', description: 'Fecha hasta (YYYY-MM-DD).' })
  @IsOptional()
  @IsDateString({}, { message: 'La fecha hasta debe tener el formato YYYY-MM-DD.' })
  fechaHasta?: string;

  @ApiPropertyOptional({
    example: 'boleta',
    description: 'Busca por concepto o N° de comprobante.',
  })
  @IsOptional()
  @IsString()
  busqueda?: string;
}
