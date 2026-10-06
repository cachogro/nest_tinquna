import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * Cuerpo del `POST /contabilidad/bien-dacion-pago`: registra un bien
 * recibido en dación de pago (estado EN_POSESION). El destinatario del que
 * se recibe es una persona O un actor productivo minero (excluyentes), y
 * debe tener un kardex ABIERTO — si no tiene, se rechaza el registro.
 * No genera ningún movimiento de kardex ni de caja.
 */
export class CreateBienDacionPagoDto {
  @ApiPropertyOptional({
    example: '20',
    description:
      'Id de la persona (persona_ci) de la que se recibe el bien. Excluyente con idActorProductivoMinero (uno de los dos es obligatorio). Debe tener un kardex ABIERTO.',
  })
  @IsOptional()
  @IsString({ message: 'El id de la persona debe ser una cadena de texto.' })
  idPersona?: string;

  @ApiPropertyOptional({
    example: '4',
    description:
      'Id del actor productivo minero del que se recibe el bien. Excluyente con idPersona (uno de los dos es obligatorio). Debe tener un kardex ABIERTO.',
  })
  @IsOptional()
  @IsString({ message: 'El id del actor productivo minero debe ser una cadena de texto.' })
  idActorProductivoMinero?: string;

  @ApiProperty({ example: '2026-09-24', description: 'Fecha de recepción (YYYY-MM-DD).' })
  @IsDateString({}, { message: 'La fecha debe tener el formato YYYY-MM-DD.' })
  fechaRecepcion: string;

  @ApiProperty({
    example: 'AUTO TOYOTA HILUX, PLACA 1234-ABC, AÑO 2015',
    description: 'Descripción del bien recibido.',
  })
  @IsString({ message: 'La descripción debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'La descripción es obligatoria.' })
  @MaxLength(255, { message: 'La descripción no puede exceder los 255 caracteres.' })
  descripcion: string;

  @ApiProperty({
    example: 5000,
    description:
      'Valor acordado con el dueño por el bien (Bs.): lo que se propone amortizar de su deuda al tomarlo en pago o venderlo.',
  })
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El valor acordado debe ser numérico con hasta 2 decimales.' },
  )
  @IsPositive({ message: 'El valor acordado debe ser mayor a 0.' })
  valorReferencial: number;

  @ApiPropertyOptional({
    example: 'ENTREGADO A CUENTA DE SU DEUDA POR ANTICIPOS.',
    description: 'Observaciones libres.',
  })
  @IsOptional()
  @IsString({ message: 'Las observaciones deben ser una cadena de texto.' })
  @MaxLength(500, { message: 'Las observaciones no pueden exceder los 500 caracteres.' })
  observaciones?: string;
}
