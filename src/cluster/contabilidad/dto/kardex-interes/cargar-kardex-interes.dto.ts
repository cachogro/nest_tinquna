import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/** Carga los intereses pendientes al kardex como una línea DEBE. */
export class CargarKardexInteresDto {
  @ApiPropertyOptional({
    example: '2026-10-07',
    description: 'Fecha de la línea en el kardex (YYYY-MM-DD). Por defecto, hoy.',
  })
  @IsOptional()
  @IsDateString({}, { message: 'La fecha debe tener el formato YYYY-MM-DD.' })
  fecha?: string;

  @ApiPropertyOptional({
    example: false,
    description:
      'true: además deja de generar intereses. false (por defecto): el plan sigue corriendo los meses siguientes.',
  })
  @IsOptional()
  @IsBoolean({ message: 'finalizar debe ser verdadero o falso.' })
  finalizar?: boolean;

  @ApiPropertyOptional({ example: 'ACUERDO DE PAGO DEL 07/10/2026' })
  @IsOptional()
  @IsString({ message: 'La observación debe ser una cadena de texto.' })
  @MaxLength(500, { message: 'La observación no puede exceder los 500 caracteres.' })
  observacion?: string;
}
