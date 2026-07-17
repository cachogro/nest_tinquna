import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class FiltrosIngenioDto {
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
  @IsString() // ✅ Recibimos como string
  activo?: string;

  @IsOptional()
  @IsIn(['id', 'nombre', 'direccion', 'telefono'])
  orderBy = 'nombre';

  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  orderDirection: 'ASC' | 'DESC' = 'ASC';
}
