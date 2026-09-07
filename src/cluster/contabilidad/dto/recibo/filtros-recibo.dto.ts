import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';
import { PaginacionQueryDto } from 'src/common/dto/paginacion-query.dto';

export class FiltrosReciboDto extends PaginacionQueryDto {
  @ApiPropertyOptional({ enum: ['INGRESO', 'EGRESO'], example: 'EGRESO' })
  @IsOptional()
  @IsIn(['INGRESO', 'EGRESO'], { message: 'El tipo debe ser INGRESO o EGRESO.' })
  tipo?: 'INGRESO' | 'EGRESO';

  @ApiPropertyOptional({ example: '18', description: 'Id de la persona (contraparte del recibo).' })
  @IsOptional()
  @IsString()
  idPersona?: string;

  @ApiPropertyOptional({
    enum: ['BORRADOR', 'PROCESADO', 'ANULADO'],
    example: 'BORRADOR',
    description: 'Estado del recibo.',
  })
  @IsOptional()
  @IsIn(['BORRADOR', 'PROCESADO', 'ANULADO'], {
    message: 'El estado debe ser BORRADOR, PROCESADO o ANULADO.',
  })
  estado?: 'BORRADOR' | 'PROCESADO' | 'ANULADO';

  @ApiPropertyOptional({ example: '2026-09-01', description: 'Fecha desde (YYYY-MM-DD).' })
  @IsOptional()
  @IsDateString({}, { message: 'La fecha desde debe tener el formato YYYY-MM-DD.' })
  fechaDesde?: string;

  @ApiPropertyOptional({ example: '2026-09-30', description: 'Fecha hasta (YYYY-MM-DD).' })
  @IsOptional()
  @IsDateString({}, { message: 'La fecha hasta debe tener el formato YYYY-MM-DD.' })
  fechaHasta?: string;

  // `busqueda` se hereda de PaginacionQueryDto: busca por concepto, nombre /
  // apellidos de la persona, o número de recibo (ej. "R-0020", "C-0932").

  @ApiPropertyOptional({
    enum: ['fecha', 'numero', 'id', 'montoTotal'],
    description: 'Columna de ordenamiento (default: fecha).',
  })
  @IsOptional()
  @IsIn(['fecha', 'numero', 'id', 'montoTotal'])
  orderBy = 'fecha';
}
