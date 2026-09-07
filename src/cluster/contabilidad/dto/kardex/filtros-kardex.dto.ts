import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { PaginacionQueryDto } from 'src/common/dto/paginacion-query.dto';

export class FiltrosKardexDto extends PaginacionQueryDto {
  @ApiPropertyOptional({ enum: ['ACTOR', 'PERSONAL'] })
  @IsOptional()
  @IsIn(['ACTOR', 'PERSONAL'], { message: 'El tipo debe ser ACTOR o PERSONAL.' })
  tipo?: 'ACTOR' | 'PERSONAL';

  @ApiPropertyOptional({ enum: ['ABIERTO', 'CERRADO'] })
  @IsOptional()
  @IsIn(['ABIERTO', 'CERRADO'], {
    message: 'El estado debe ser ABIERTO o CERRADO.',
  })
  estado?: 'ABIERTO' | 'CERRADO';

  @ApiPropertyOptional({ example: 2026, description: 'Gestión (año) de apertura.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  gestion?: number;

  @ApiPropertyOptional({
    example: '2',
    description: 'Acota el listado al kardex (todos los N°) de un actor puntual.',
  })
  @IsOptional()
  @IsString()
  idActorProductivoMinero?: string;

  @ApiPropertyOptional({
    example: '15',
    description: 'Acota el listado al kardex (todos los N°) de una persona puntual.',
  })
  @IsOptional()
  @IsString()
  idPersona?: string;

  // `busqueda` se hereda de PaginacionQueryDto: busca por nombre del actor,
  // nombre/apellidos de la persona o descripción del kardex.

  @ApiPropertyOptional({
    enum: ['id', 'numero', 'gestion', 'estado', 'fechaApertura'],
    description: 'Columna de ordenamiento (default: fechaApertura).',
  })
  @IsOptional()
  @IsIn(['id', 'numero', 'gestion', 'estado', 'fechaApertura'])
  orderBy = 'fechaApertura';
}
