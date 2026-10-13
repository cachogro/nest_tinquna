import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/** Perdona los intereses pendientes del plan (no se cobran). */
export class CondonarKardexInteresDto {
  @ApiProperty({
    example: 'ACUERDO CON GERENCIA: SE CONDONAN LOS INTERESES',
    description: 'Motivo de la condonación / quién la autorizó.',
  })
  @IsString({ message: 'La observación debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'Indicá el motivo de la condonación.' })
  @MaxLength(500, { message: 'La observación no puede exceder los 500 caracteres.' })
  observacion: string;

  @ApiPropertyOptional({
    example: true,
    description:
      'true (por defecto): además deja de generar intereses. false: perdona lo acumulado pero el plan sigue corriendo los meses siguientes.',
  })
  @IsOptional()
  @IsBoolean({ message: 'finalizar debe ser verdadero o falso.' })
  finalizar?: boolean;
}
