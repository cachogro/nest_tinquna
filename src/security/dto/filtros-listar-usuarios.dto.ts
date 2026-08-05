import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional } from 'class-validator';
import { PaginacionQueryDto } from 'src/common/dto/paginacion-query.dto';
import { parseBooleanQueryParam } from 'src/common/utils/boolean-query.transform';

export class FiltrosListarUsuariosDto extends PaginacionQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  idRol?: number;

  @IsOptional()
  @Transform(parseBooleanQueryParam)
  @IsBoolean()
  activo?: boolean;

  // 'nombres' ordena por persona.nombres (persona es @OneToOne, no duplica
  // filas). No se permite ordenar por columnas de `roles` (ManyToMany) para
  // no reintroducir la ambigüedad que resuelve paginarConJoinMultiple.
  @IsOptional()
  @IsIn(['id', 'usuario', 'nombres'])
  orderBy = 'id';
}
