import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, Max, Min, ValidateIf } from 'class-validator';

import { CerrarGestionCajaDto } from './cerrar-gestion-caja.dto';

/** Valor del parámetro de ruta `:accion`, común a caja y libreta de bancos. */
export enum AccionPeriodo {
  CERRAR = 'cerrar',
  REABRIR = 'reabrir',
}
export const ACCIONES_PERIODO = Object.values(AccionPeriodo);

export type AlcancePeriodo = 'MES' | 'GESTION';

/**
 * Cuerpo de `POST movimiento-caja/periodo/:accion`. El `alcance` es
 * explícito a propósito: olvidarse el `mes` no debe terminar cerrando la
 * gestión entera.
 */
export class AccionPeriodoCajaDto extends CerrarGestionCajaDto {
  @ApiProperty({
    enum: ['MES', 'GESTION'],
    example: 'MES',
    description: 'MES = un período mensual; GESTION = el año completo.',
  })
  @IsIn(['MES', 'GESTION'], { message: 'El alcance debe ser MES o GESTION.' })
  alcance: AlcancePeriodo;

  @ApiPropertyOptional({
    example: 7,
    description:
      'Mes a cerrar / reabrir (1-12). Obligatorio si el alcance es MES.',
  })
  @ValidateIf((o: AccionPeriodoCajaDto) => o.alcance === 'MES')
  @Type(() => Number)
  @IsInt({ message: 'El mes debe ser un número entero.' })
  @Min(1, { message: 'El mes debe estar entre 1 y 12.' })
  @Max(12, { message: 'El mes debe estar entre 1 y 12.' })
  mes?: number;
}
