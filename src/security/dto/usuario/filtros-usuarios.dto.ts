import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class FiltrosListarUsuariosDto {
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
  idRol?: number;

  @IsOptional()
  @Transform(({ value }) =>
    value !== undefined ? value === 'true' : undefined,
  )
  @IsBoolean()
  activo?: boolean;
}