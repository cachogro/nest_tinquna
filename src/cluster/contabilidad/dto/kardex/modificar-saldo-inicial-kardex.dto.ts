import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber } from 'class-validator';

/**
 * Cuerpo del `PATCH /contabilidad/kardex/:id/saldo-inicial`: corrige el
 * saldo / deuda de apertura del kardex N° 1 de un titular.
 */
export class ModificarSaldoInicialKardexDto {
  @ApiProperty({
    example: 4200,
    description:
      'Nuevo saldo / deuda con el que arranca el kardex N° 1. Se recalculan el saldo de todas sus líneas y, si ya se cerró, el de los kardex siguientes (N° 2, N° 3...), que arrastran el saldo de cierre.',
  })
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El saldo inicial debe ser numérico con hasta 2 decimales.' },
  )
  saldoInicial: number;
}
