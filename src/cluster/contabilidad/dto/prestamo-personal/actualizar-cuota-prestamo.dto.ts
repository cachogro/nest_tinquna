import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';

/** Cuerpo del `PATCH /contabilidad/prestamo-personal/:id/cuota`: renegociar la cuota. */
export class ActualizarCuotaPrestamoDto {
  @ApiProperty({ example: 800, description: 'Nueva cuota mensual pactada (Bs.).' })
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'La cuota mensual debe ser numérica con hasta 2 decimales.' },
  )
  @IsPositive({ message: 'La cuota mensual debe ser mayor a 0.' })
  cuotaMensual: number;

  @ApiPropertyOptional({ example: 'SE REDUCE LA CUOTA POR PEDIDO DEL EMPLEADO, APROBADO POR GERENCIA.' })
  @IsOptional()
  @IsString({ message: 'Las observaciones deben ser una cadena de texto.' })
  @MaxLength(500, { message: 'Las observaciones no pueden exceder los 500 caracteres.' })
  observaciones?: string;
}
