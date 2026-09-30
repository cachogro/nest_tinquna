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
import { DatosPagoDto } from './datos-pago.dto';

/**
 * Cuerpo del `POST /contabilidad/prestamo-personal`: otorga un préstamo a un
 * empleado. En el mismo paso genera el recibo de EGRESO real (caja o banco),
 * el DEBE en su kardex PERSONAL y la línea 1 (OTORGAMIENTO) del sub-libro
 * del préstamo.
 */
export class CreatePrestamoPersonalDto extends DatosPagoDto {
  @ApiProperty({
    example: '18',
    description:
      'Id de la persona (persona_ci). Debe ser personal de la empresa con kardex PERSONAL abierto.',
  })
  @IsNotEmpty({ message: 'Debe indicar la persona (idPersona).' })
  @IsString({ message: 'El id de la persona debe ser una cadena de texto.' })
  idPersona: string;

  @ApiProperty({ example: '2026-09-29', description: 'Fecha de entrega (YYYY-MM-DD).' })
  @IsDateString({}, { message: 'La fecha debe tener el formato YYYY-MM-DD.' })
  fecha: string;

  @ApiProperty({
    example: 'COMPRA DE MOTO HONDA XR150',
    description:
      'A cuenta de qué se presta. El concepto del recibo y del kardex queda "PRÉSTAMO N° x: <descripcion>".',
  })
  @IsString({ message: 'La descripción debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'La descripción es obligatoria.' })
  @MaxLength(200, { message: 'La descripción no puede exceder los 200 caracteres.' })
  descripcion: string;

  @ApiProperty({ example: 12000, description: 'Monto prestado en Bs. (mayor a 0).' })
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El monto debe ser numérico con hasta 2 decimales.' },
  )
  @IsPositive({ message: 'El monto debe ser mayor a 0.' })
  monto: number;

  @ApiProperty({
    example: 1000,
    description:
      'Cuota mensual pactada (Bs.) que se sugiere descontar en cada boleta de pago. No puede superar el monto.',
  })
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'La cuota mensual debe ser numérica con hasta 2 decimales.' },
  )
  @IsPositive({ message: 'La cuota mensual debe ser mayor a 0.' })
  cuotaMensual: number;

  @ApiPropertyOptional({ example: 'PACTADO CON GERENCIA, 12 CUOTAS.' })
  @IsOptional()
  @IsString({ message: 'Las observaciones deben ser una cadena de texto.' })
  @MaxLength(500, { message: 'Las observaciones no pueden exceder los 500 caracteres.' })
  observaciones?: string;
}
