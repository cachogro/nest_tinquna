import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

export type FormatoReporte = 'EXCEL' | 'PDF';

/**
 * Formato de salida de los reportes de contabilidad. Lo heredan los filtros
 * de cada reporte: el PDF es el mismo libro que el Excel, en hoja carta.
 */
export class FormatoReporteDto {
  @ApiPropertyOptional({
    enum: ['EXCEL', 'PDF'],
    default: 'EXCEL',
    description:
      'Formato del archivo. PDF = el mismo reporte en hoja carta, con las páginas numeradas.',
  })
  @IsOptional()
  @IsIn(['EXCEL', 'PDF'], { message: 'El formato debe ser EXCEL o PDF.' })
  formato?: FormatoReporte;
}
