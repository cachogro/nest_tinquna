import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';
import { DatosPagoDto } from '../prestamo-personal/datos-pago.dto';

/**
 * Cuerpo del `POST /contabilidad/bien-dacion-pago/:id/gasto`: un gasto que
 * la empresa le invierte a un bien TOMADO_EN_PAGO. Sale DIRECTO de la caja de
 * flujo (efectivo) o de la libreta de bancos (con cuenta bancaria), sin
 * recibo, y no toca el kardex del dueño.
 */
export class CreateBienDacionPagoGastoDto extends DatosPagoDto {
  @ApiProperty({ example: '2026-10-05', description: 'Fecha del gasto (YYYY-MM-DD).' })
  @IsDateString({}, { message: 'La fecha debe tener el formato YYYY-MM-DD.' })
  fecha: string;

  @ApiProperty({ example: 'ARREGLO DE LLANTA', description: 'En qué se gastó.' })
  @IsString({ message: 'El concepto debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'El concepto es obligatorio.' })
  @MaxLength(255, { message: 'El concepto no puede exceder los 255 caracteres.' })
  concepto: string;

  @ApiProperty({ example: 400, description: 'Monto del gasto (mayor a 0).' })
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El monto debe ser numérico con hasta 2 decimales.' },
  )
  @IsPositive({ message: 'El monto debe ser mayor a 0.' })
  monto: number;
}
