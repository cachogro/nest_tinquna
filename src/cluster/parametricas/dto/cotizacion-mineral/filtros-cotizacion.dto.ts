import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional } from 'class-validator';
import { PaginacionQueryDto } from 'src/common/dto/paginacion-query.dto';
import { parseBooleanQueryParam } from 'src/common/utils/boolean-query.transform';

export class FiltrosCotizacionDto extends PaginacionQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  idMineral?: number;

  @IsOptional()
  @Transform(parseBooleanQueryParam)
  @IsBoolean()
  vigente?: boolean;

  @IsOptional()
  @Transform(parseBooleanQueryParam)
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @IsIn(['id', 'mineral', 'fechaVigenciaInicial', 'fechaVigenciaFinal'])
  orderBy = 'id';
}
