import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsNumber, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';

/**
 * Cuerpo del `POST /contabilidad/bien-dacion-pago/:id/tomar-en-pago`: la
 * empresa se queda con el bien y le abona al dueño el valor acordado en su
 * kardex (HABER), sin mover caja. Desde ahí el bien ya no se devuelve.
 */
export class TomarEnPagoBienDacionPagoDto {
  @ApiProperty({ example: '2026-10-02', description: 'Fecha en que se toma el bien en pago (YYYY-MM-DD).' })
  @IsDateString({}, { message: 'La fecha debe tener el formato YYYY-MM-DD.' })
  fecha: string;

  @ApiPropertyOptional({
    example: 5000,
    description:
      'Monto que se abona al kardex del dueño. Si se omite, es el valor acordado del bien.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El monto a amortizar debe ser numérico con hasta 2 decimales.' },
  )
  @IsPositive({ message: 'El monto a amortizar debe ser mayor a 0.' })
  montoAmortizar?: number;

  @ApiPropertyOptional({
    example: 'SE ACORDÓ QUEDARNOS CON LA MOTO PARA ARREGLARLA Y VENDERLA.',
    description: 'Observaciones libres (reemplaza las anteriores si se envía).',
  })
  @IsOptional()
  @IsString({ message: 'Las observaciones deben ser una cadena de texto.' })
  @MaxLength(500, { message: 'Las observaciones no pueden exceder los 500 caracteres.' })
  observaciones?: string;
}
