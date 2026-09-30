import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsNumber, IsPositive } from 'class-validator';
import { DatosPagoDto } from './datos-pago.dto';

/**
 * Cuerpo del `POST /contabilidad/prestamo-personal/:id/abono`: el empleado
 * paga parte (o todo) del préstamo con dinero propio, fuera del sueldo.
 * Genera un recibo de INGRESO (entra a caja o banco), el HABER en su kardex
 * PERSONAL y la línea ABONO del sub-libro.
 */
export class AbonarPrestamoDto extends DatosPagoDto {
  @ApiProperty({ example: '2026-10-15', description: 'Fecha del abono (YYYY-MM-DD).' })
  @IsDateString({}, { message: 'La fecha debe tener el formato YYYY-MM-DD.' })
  fecha: string;

  @ApiProperty({
    example: 2000,
    description: 'Monto abonado en Bs. (mayor a 0, no puede superar el saldo del préstamo).',
  })
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El monto debe ser numérico con hasta 2 decimales.' },
  )
  @IsPositive({ message: 'El monto debe ser mayor a 0.' })
  monto: number;
}
