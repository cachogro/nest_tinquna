import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional } from 'class-validator';
import { PaginacionQueryDto } from 'src/common/dto/paginacion-query.dto';
import { parseBooleanQueryParam } from 'src/common/utils/boolean-query.transform';

export class FiltrosActorProductivoMineroDto extends PaginacionQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  idTipoActorProductivoMinero?: number;

  @IsOptional()
  @Transform(parseBooleanQueryParam)
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @IsIn(['id', 'nombre', 'direccion', 'telefono', 'tipoActorProductivoMinero'])
  orderBy = 'nombre';

  // Override del default heredado de PaginacionQueryDto ('DESC'): un catálogo
  // de actores productivos se lee mejor alfabéticamente de forma ascendente.
  // La validación @IsIn(['ASC','DESC']) sigue aplicando por herencia.
  orderDirection: 'ASC' | 'DESC' = 'ASC';
}
