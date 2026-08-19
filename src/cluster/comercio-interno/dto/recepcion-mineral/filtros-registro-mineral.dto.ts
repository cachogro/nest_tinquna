import { Transform, Type } from 'class-transformer';
import {
  IsDate,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { PaginacionQueryDto } from 'src/common/dto/paginacion-query.dto';

export class FiltrosRegistroMineralDto extends PaginacionQueryDto {
  @IsOptional()
  @IsString()
  codigoOperacion?: string;

  // Código de codificación del mineral (ej. "ICC"), ver Codificacion.codigo.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  idCodificacion?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  idEstado?: number;

  @IsOptional()
  @Transform(({ value }) => (value ? new Date(`${value}`) : undefined))
  @IsDate()
  fechaDesde?: Date;

  @IsOptional()
  @Transform(({ value }) => (value ? new Date(`${value}`) : undefined))
  @IsDate()
  fechaHasta?: Date;

  // Alternativa a fechaDesde/fechaHasta para fraccionar exportaciones masivas
  // (todos los estados, sin código ni proveedor) por mes o por semana ISO.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  anio?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  mes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(53)
  semana?: number;

  @IsOptional()
  @IsIn([
    'id',
    'codigoOperacion',
    'fechaRecepcion',
    'numeroDocumento',
    'estado',
  ])
  orderBy = 'fechaRecepcion';
}
