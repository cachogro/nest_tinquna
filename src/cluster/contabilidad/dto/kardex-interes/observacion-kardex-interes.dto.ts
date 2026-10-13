import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Finalizar un plan o revertir un cargo: solo el motivo, opcional. */
export class ObservacionKardexInteresDto {
  @ApiPropertyOptional({ example: 'SE PUSO AL DÍA CON SUS PAGOS' })
  @IsOptional()
  @IsString({ message: 'La observación debe ser una cadena de texto.' })
  @MaxLength(500, { message: 'La observación no puede exceder los 500 caracteres.' })
  observacion?: string;
}
