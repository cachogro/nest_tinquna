import { Transform, Type } from 'class-transformer';
import { IsDate, IsIn, IsInt, IsOptional, IsString } from 'class-validator';
import { PaginacionQueryDto } from 'src/common/dto/paginacion-query.dto';

export class FiltrosRegistroMineralDto extends PaginacionQueryDto {
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
  @Transform(({ value }) => (value ? new Date(`${value}`) : undefined))
  @IsDate()
  fechaDesde?: Date;

  @IsOptional()
  @Transform(({ value }) => (value ? new Date(`${value}`) : undefined))
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
}
