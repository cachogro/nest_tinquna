import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginacionQueryDto } from 'src/common/dto/paginacion-query.dto';
import { parseBooleanQueryParam } from 'src/common/utils/boolean-query.transform';

export class FiltrosBitacoraAccesoDto extends PaginacionQueryDto {
  @ApiPropertyOptional({ description: 'Filtra por ID de usuario.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  idUsuario?: number;

  @ApiPropertyOptional({
    description: 'Filtra por tipo de evento exacto.',
    example: 'LOGIN_FALLIDO_CONTRASENA',
  })
  @IsOptional()
  @IsString()
  tipoEvento?: string;

  @ApiPropertyOptional({
    description: 'Filtra por eventos exitosos (true) o fallidos (false).',
  })
  @IsOptional()
  @Transform(parseBooleanQueryParam)
  @IsBoolean()
  exitoso?: boolean;

  @ApiPropertyOptional({ description: 'Fecha desde (inclusive).' })
  @IsOptional()
  @Transform(({ value }) => (value ? new Date(`${value}`) : undefined))
  @IsDate()
  fechaDesde?: Date;

  @ApiPropertyOptional({ description: 'Fecha hasta (inclusive).' })
  @IsOptional()
  @Transform(({ value }) => (value ? new Date(`${value}`) : undefined))
  @IsDate()
  fechaHasta?: Date;

  @ApiPropertyOptional({
    description: 'Columna de ordenamiento.',
    enum: ['fechaRegistro', 'tipoEvento', 'usuarioIngresado'],
    default: 'fechaRegistro',
  })
  @IsOptional()
  @IsIn(['fechaRegistro', 'tipoEvento', 'usuarioIngresado'])
  orderBy = 'fechaRegistro';
}
