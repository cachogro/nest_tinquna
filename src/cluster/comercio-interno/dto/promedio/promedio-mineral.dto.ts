import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { PaginacionQueryDto } from 'src/common/dto/paginacion-query.dto';
import { PaginadoResponseDto } from 'src/common/dto/paginado-response.dto';
import { PromedioMineral } from '../../entities/promedio/promedio-mineral.entity';

export class CreatePromedioMineralDto {
  @ApiProperty({
    example: '1',
    description:
      'Id de la codificación del lote (MC, TM, C, RV...). El código del lote ' +
      '(ej. MC-0001) usa el correlativo propio de esa codificación.',
  })
  @IsNumberString()
  idCodificacionLote: string;

  @ApiPropertyOptional({ example: 'JULIO BAJAS 461', maxLength: 150 })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  descripcion?: string;

  @ApiPropertyOptional({
    example: '2026-07-03',
    description: 'YYYY-MM-DD. Por defecto hoy.',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'fecha debe tener formato YYYY-MM-DD.',
  })
  fecha?: string;

  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  observaciones?: string;

  @ApiProperty({
    type: [String],
    example: ['12', '15', '18'],
    description:
      'Ids de las valorizaciones (PRE-VALORIZADO o VALORIZADO) que conforman el promedio. ' +
      'No pueden pertenecer ya a otro promedio.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsString({ each: true })
  idsValorizacion: string[];
}

export class UpdatePromedioMineralDto {
  @ApiPropertyOptional({
    example: '2',
    description:
      'Cambia la codificación del lote. Si es distinta de la actual, el promedio ' +
      'toma el siguiente correlativo de la NUEVA codificación; el correlativo de ' +
      'la anterior no se reutiliza ni se altera. Si es la misma, no cambia nada.',
  })
  @IsOptional()
  @IsNumberString()
  idCodificacionLote?: string;

  @ApiPropertyOptional({ maxLength: 150 })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  descripcion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'fecha debe tener formato YYYY-MM-DD.',
  })
  fecha?: string;

  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  observaciones?: string;

  @ApiPropertyOptional({
    type: [String],
    description:
      'Si se envía, REEMPLAZA la composición del promedio: las valorizaciones ' +
      'que ya no estén se liberan y las nuevas se marcan. Se recalculan pesos y leyes.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsString({ each: true })
  idsValorizacion?: string[];
}

export class FiltrosPromedioMineralDto extends PaginacionQueryDto {
  @ApiPropertyOptional({
    description: 'Filtra por código del promedio (PRM-0001).',
  })
  @IsOptional()
  @IsString()
  codigo?: string;

  @IsOptional()
  @IsIn(['id', 'codigo', 'fecha', 'pesoTotalKilogramos'])
  orderBy = 'id';
}

export type PeriodoReportePromedio = 'diario' | 'semanal' | 'mensual';

export const ESTADOS_VENTA_REPORTE_PROMEDIO = [
  'todos',
  'sin_vender',
  'vendidos',
  'venta_abierta',
  'liquidados',
  'anulados',
] as const;
export type EstadoVentaReportePromedio =
  (typeof ESTADOS_VENTA_REPORTE_PROMEDIO)[number];

export class FiltroReportePromedioDto {
  @ApiPropertyOptional({
    enum: ['diario', 'semanal', 'mensual'],
    default: 'diario',
    description:
      'diario = solo la fecha indicada; semanal = lunes a domingo de la semana ' +
      'que contiene la fecha; mensual = el mes completo de la fecha.',
  })
  @IsOptional()
  @IsIn(['diario', 'semanal', 'mensual'])
  periodo: PeriodoReportePromedio = 'diario';

  @ApiPropertyOptional({
    example: '2026-07-03',
    description:
      'Fecha de referencia del período (YYYY-MM-DD). Por defecto hoy.',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'fecha debe tener formato YYYY-MM-DD.',
  })
  fecha?: string;

  @ApiPropertyOptional({
    example: '1',
    description:
      'Solo los lotes de esta codificación de lote (MC, TM, C, RV...).',
  })
  @IsOptional()
  @IsNumberString()
  idCodificacionLote?: string;

  @ApiPropertyOptional({
    example: 'MC',
    description:
      'Solo los lotes de esta codificación de lote, por código. No distingue mayúsculas.',
  })
  @IsOptional()
  @IsString()
  codificacionLote?: string;

  @ApiPropertyOptional({
    example: 3,
    description:
      'Solo los lotes que contienen valorizaciones de esta codificación ' +
      '(ICC, AC...), según la codificación con la que se valorizó.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  idCodificacion?: number;

  @ApiPropertyOptional({
    example: 'ICC',
    description:
      'Igual que idCodificacion, pero por código. No distingue mayúsculas.',
  })
  @IsOptional()
  @IsString()
  codificacion?: string;

  @ApiPropertyOptional({
    enum: [...ESTADOS_VENTA_REPORTE_PROMEDIO],
    default: 'todos',
    description:
      'todos = lotes activos (vendidos o no); sin_vender = sin venta vigente ' +
      '(faltantes por vender); vendidos = venta ABIERTA o LIQUIDADA; ' +
      'venta_abierta = vendido pendiente de liquidar; liquidados = venta LIQUIDADA; ' +
      'anulados = promedios anulados.',
  })
  @IsOptional()
  @IsIn(ESTADOS_VENTA_REPORTE_PROMEDIO)
  estado: EstadoVentaReportePromedio = 'todos';
}

export class FiltrosDisponiblesPromedioDto extends PaginacionQueryDto {
  @ApiPropertyOptional({
    description: 'Solo esta codificación (ICC, AC, ...).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  idCodificacion?: number;

  @ApiPropertyOptional({
    description:
      'Solo esta codificación por su código (ej. ICC, AC). No distingue mayúsculas.',
    example: 'ICC',
  })
  @IsOptional()
  @IsString()
  codificacion?: string;

  @ApiPropertyOptional({
    enum: ['ambas', 'pre_valorizadas', 'valorizadas'],
    default: 'ambas',
  })
  @IsOptional()
  @IsIn(['ambas', 'pre_valorizadas', 'valorizadas'])
  estado?: 'ambas' | 'pre_valorizadas' | 'valorizadas' = 'ambas';

  @IsOptional()
  @IsIn(['id', 'codigoOperacion', 'peso'])
  orderBy = 'codigoOperacion';

  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  orderDirection: 'ASC' | 'DESC' = 'ASC';
}

export class FilaDisponiblePromedioDto {
  idValorizacion: string;
  codigoOperacion: string | null;
  // Codificación con la que se valorizó (puede diferir de la de la recepción).
  codificacion: string | null;
  // Codificación original de la recepción (la del código de operación).
  codificacionRecepcion: string | null;
  proveedor: string;
  numeroSacos: number | null;
  pesoKg: number;
  // Humedad (%) de la valorización (o de la recepción si aquella no la tiene).
  humedadPorcentaje: number | null;
  // Valor neto de venta de la valorización, en Bs (total_valor_neto_venta_bolivianos).
  valorNetoVentaBolivianos: number;
  leyes: {
    idMineral: string;
    mineral: string | null;
    ley: number;
    unidad: string | null;
  }[];
  idEstadoValorizacion: number | null;
  estadoValorizacion: string | null;
  entregado: boolean;
  fechaValorizacion: string | null;
}

export class DisponiblesPromedioPaginadoDto extends PaginadoResponseDto<FilaDisponiblePromedioDto> {
  declare data: FilaDisponiblePromedioDto[];
}

export class PromediosMineralPaginadosDto extends PaginadoResponseDto<PromedioMineral> {
  @ApiProperty({ type: () => [PromedioMineral] })
  declare data: PromedioMineral[];
}
