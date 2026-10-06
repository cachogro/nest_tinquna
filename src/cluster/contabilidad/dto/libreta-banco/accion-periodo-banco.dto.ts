import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, Max, Min, ValidateIf } from 'class-validator';

import { AlcancePeriodo } from '../movimiento-caja/accion-periodo-caja.dto';
import { CerrarGestionBancoDto } from './cerrar-gestion-banco.dto';

/**
 * Cuerpo de `POST libreta-banco/periodo/:accion`. El `alcance` es explícito
 * a propósito: olvidarse el `mes` no debe terminar cerrando la gestión
 * entera.
 */
export class AccionPeriodoBancoDto extends CerrarGestionBancoDto {
  @ApiProperty({
    enum: ['MES', 'GESTION'],
    example: 'MES',
    description: 'MES = un período mensual; GESTION = el año completo.',
  })
  @IsIn(['MES', 'GESTION'], { message: 'El alcance debe ser MES o GESTION.' })
  alcance: AlcancePeriodo;

  @ApiPropertyOptional({
    example: 5,
    description:
      'Mes a cerrar / reabrir (1-12). Obligatorio si el alcance es MES.',
  })
  @ValidateIf((o: AccionPeriodoBancoDto) => o.alcance === 'MES')
  @Type(() => Number)
  @IsInt({ message: 'El mes debe ser un número entero.' })
  @Min(1, { message: 'El mes debe estar entre 1 y 12.' })
  @Max(12, { message: 'El mes debe estar entre 1 y 12.' })
  mes?: number;
}
