import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

import { FormatoReporteDto } from '../reporte/formato-reporte.dto';

export class FiltroDeudasTotalesDto extends FormatoReporteDto {
  @ApiPropertyOptional({
    enum: ['ACTOR', 'ASOCIADO', 'PERSONAL', 'CLIENTE'],
    description: 'Acota el reporte a un tipo de kardex. Sin valor: todos.',
  })
  @IsOptional()
  @IsIn(['ACTOR', 'ASOCIADO', 'PERSONAL', 'CLIENTE'], {
    message: 'El tipo debe ser ACTOR, ASOCIADO, PERSONAL o CLIENTE.',
  })
  tipo?: 'ACTOR' | 'ASOCIADO' | 'PERSONAL' | 'CLIENTE';
}
