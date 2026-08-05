import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString } from 'class-validator';
import { PaginacionQueryDto } from 'src/common/dto/paginacion-query.dto';
import { parseBooleanQueryParam } from 'src/common/utils/boolean-query.transform';

export class FiltrosPersonaDto extends PaginacionQueryDto {
  @IsOptional()
  @IsString()
  numeroDocumento?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  idTipoPersona?: number;

  @IsOptional()
  @Transform(parseBooleanQueryParam)
  @IsBoolean()
  activo?: boolean;

  // No se permite ordenar por columnas de `personaTipos` (OneToMany): ver
  // paginarConJoinMultiple, que evita que ese join duplique filas.
  @IsOptional()
  @IsIn(['id', 'nombres', 'numeroDocumento'])
  orderBy = 'id';
}
