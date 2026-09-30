import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional } from 'class-validator';
import { PaginacionQueryDto } from 'src/common/dto/paginacion-query.dto';
import { parseBooleanQueryParam } from 'src/common/utils/boolean-query.transform';

export class FiltrosClienteDto extends PaginacionQueryDto {
  @IsOptional()
  @Transform(parseBooleanQueryParam)
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  idTipoActorProductivoMinero?: number;

  @IsOptional()
  @IsIn(['id', 'nombre', 'direccion', 'telefono'])
  orderBy = 'nombre';

  // Override del default heredado de PaginacionQueryDto ('DESC'): un catálogo
  // de clientes se lee mejor alfabéticamente de forma ascendente.
  orderDirection: 'ASC' | 'DESC' = 'ASC';
}
