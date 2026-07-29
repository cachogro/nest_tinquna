import { Transform, Type } from 'class-transformer';
import {
  IsDate,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class FiltrosRegistroMineralDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit = 10;

  @IsOptional()
  @IsString()
  busqueda?: string;

  @IsOptional()
  @IsString()
  codigoOperacion?: string;

  @IsOptional()
  @IsString()
  numeroDocumento?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  idEstado?: number;

  @IsOptional()
  @Transform(({ value }) =>
    value ? new Date(`${value}`) : undefined,
  )
  @IsDate()
  fechaDesde?: Date;

  @IsOptional()
  @Transform(({ value }) =>
    value ? new Date(`${value}`) : undefined,
  )
  @IsDate()
  fechaHasta?: Date;

  @IsOptional()
  @IsIn([
    'id',
    'codigoOperacion',
    'fechaRecepcion',
    'numeroDocumento',
    'estado',
  ])
  orderBy = 'fechaRecepcion';

  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  orderDirection: 'ASC' | 'DESC' = 'DESC';
}