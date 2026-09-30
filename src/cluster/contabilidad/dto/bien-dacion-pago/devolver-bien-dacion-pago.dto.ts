import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * Cuerpo del `POST /contabilidad/bien-dacion-pago/:id/devolver`.
 * `observaciones` es obligatorio acá: es donde se anota el motivo de la
 * devolución (no hay un campo `motivo` aparte).
 */
export class DevolverBienDacionPagoDto {
  @ApiProperty({ example: '2026-09-30', description: 'Fecha de la devolución (YYYY-MM-DD).' })
  @IsDateString({}, { message: 'La fecha debe tener el formato YYYY-MM-DD.' })
  fechaDevolucion: string;

  @ApiProperty({
    example: 'EL ACTOR PREFIRIÓ SALDAR LA DEUDA EN EFECTIVO Y RECUPERAR EL VEHÍCULO.',
    description: 'Motivo de la devolución (obligatorio).',
  })
  @IsString({ message: 'Las observaciones deben ser una cadena de texto.' })
  @IsNotEmpty({ message: 'Debe indicar el motivo de la devolución en observaciones.' })
  @MaxLength(500, { message: 'Las observaciones no pueden exceder los 500 caracteres.' })
  observaciones: string;
}
