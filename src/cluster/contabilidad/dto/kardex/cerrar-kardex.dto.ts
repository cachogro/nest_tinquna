import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

/**
 * Cuerpo opcional del `PATCH /contabilidad/kardex/:id/cerrar`. Sin
 * `fechaCierre` el kardex se cierra con la fecha de hoy.
 */
export class CerrarKardexDto {
  @ApiPropertyOptional({
    example: '2025-05-03',
    description:
      'Fecha de cierre (YYYY-MM-DD); por defecto hoy. Sirve para cargar kardex históricos: es también la fecha de apertura del kardex siguiente, y su año es la gestión de ese kardex. No puede ser futura, anterior a la apertura del kardex ni anterior a su último movimiento.',
  })
  @IsOptional()
  @IsDateString({}, { message: 'La fecha de cierre debe tener el formato YYYY-MM-DD.' })
  fechaCierre?: string;
}
