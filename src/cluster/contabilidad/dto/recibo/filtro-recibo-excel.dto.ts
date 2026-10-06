import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';

import { FormatoReporteDto } from '../reporte/formato-reporte.dto';

/**
 * Filtros del reporte Excel de recibos: los mismos de la bandeja
 * (`FiltrosReciboDto`) pero sin paginación ni orden, porque el reporte
 * imprime todos los recibos que cumplan los filtros en orden cronológico.
 */
export class FiltroReciboExcelDto extends FormatoReporteDto {
  @ApiPropertyOptional({ enum: ['INGRESO', 'EGRESO'], example: 'EGRESO' })
  @IsOptional()
  @IsIn(['INGRESO', 'EGRESO'], { message: 'El tipo debe ser INGRESO o EGRESO.' })
  tipo?: 'INGRESO' | 'EGRESO';

  @ApiPropertyOptional({
    enum: ['BORRADOR', 'PROCESADO', 'ANULADO'],
    description: 'Estado del recibo. Sin valor: todos los estados.',
  })
  @IsOptional()
  @IsIn(['BORRADOR', 'PROCESADO', 'ANULADO'], {
    message: 'El estado debe ser BORRADOR, PROCESADO o ANULADO.',
  })
  estado?: 'BORRADOR' | 'PROCESADO' | 'ANULADO';

  @ApiPropertyOptional({ example: '18', description: 'Id de la persona (contraparte del recibo).' })
  @IsOptional()
  @IsString()
  idPersona?: string;

  @ApiPropertyOptional({ example: '2026-09-01', description: 'Fecha desde (YYYY-MM-DD).' })
  @IsOptional()
  @IsDateString({}, { message: 'La fecha desde debe tener el formato YYYY-MM-DD.' })
  fechaDesde?: string;

  @ApiPropertyOptional({ example: '2026-09-30', description: 'Fecha hasta (YYYY-MM-DD).' })
  @IsOptional()
  @IsDateString({}, { message: 'La fecha hasta debe tener el formato YYYY-MM-DD.' })
  fechaHasta?: string;

  @ApiPropertyOptional({
    example: 'R-0020',
    description: 'Busca por concepto, nombre/apellidos o número de recibo (ej. "R-0020").',
  })
  @IsOptional()
  @IsString()
  busqueda?: string;
}
