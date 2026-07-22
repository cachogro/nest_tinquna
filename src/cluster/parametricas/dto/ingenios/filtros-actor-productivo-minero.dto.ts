import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class FiltrosActorProductivoMineroDto {
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
  @Type(() => Number)
  @IsInt()
  idTipoActorProductivoMinero?: number;

  @IsOptional()
  @Transform(({ value }) =>
    value !== undefined ? value === 'true' : undefined,
  )
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @IsIn(['id', 'nombre', 'direccion', 'telefono', 'tipoActorProductivoMinero'])
  orderBy = 'nombre';

  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  orderDirection: 'ASC' | 'DESC' = 'ASC';
}
