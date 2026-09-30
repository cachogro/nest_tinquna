import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * Cuerpo único del `POST /contabilidad/traspaso`:
 * sin `id` registra el traspaso (genera el movimiento de caja y el de
 * libreta_banco en una sola transacción); con `id` lo actualiza.
 * El `saldo` de cada lado no se envía: lo calcula cada servicio. La caja de
 * flujo es siempre la de la empresa (Caja id=1, "CAJA PRINCIPAL"), no se
 * envía: mismo criterio que `recibo` y `movimiento-kardex`.
 */
export class CreateTraspasoDto {
  @ApiPropertyOptional({
    description: 'Id del traspaso. Presente => actualizar; ausente => crear.',
    example: 4,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive({ message: 'El id del traspaso no es válido.' })
  id?: number;

  @ApiProperty({
    enum: ['DEPOSITO', 'RETIRO'],
    example: 'DEPOSITO',
    description:
      'DEPOSITO: sale de la caja de flujo y entra a la cuenta bancaria. RETIRO: sale de la cuenta bancaria y entra a la caja de flujo.',
  })
  @IsIn(['DEPOSITO', 'RETIRO'], {
    message: 'El tipo debe ser DEPOSITO o RETIRO.',
  })
  tipo: 'DEPOSITO' | 'RETIRO';

  @ApiProperty({ example: '2026-09-22', description: 'Fecha del traspaso (YYYY-MM-DD).' })
  @IsDateString({}, { message: 'La fecha debe tener el formato YYYY-MM-DD.' })
  fecha: string;

  @ApiProperty({
    example: 1,
    description:
      'Id de la cuenta bancaria (parametrica.cuenta_bancaria). Debe estar aperturada. Su moneda define la moneda del traspaso (BS o USD).',
  })
  @Type(() => Number)
  @IsInt({ message: 'La cuenta bancaria no es válida.' })
  @IsPositive({ message: 'La cuenta bancaria no es válida.' })
  idCuentaBancaria: number;

  @ApiPropertyOptional({
    example: '4478708896',
    description: 'N° de la boleta de depósito / retiro del banco, si corresponde.',
  })
  @IsOptional()
  @IsString({ message: 'El N° de comprobante debe ser una cadena de texto.' })
  @MaxLength(30, { message: 'El N° de comprobante no puede exceder los 30 caracteres.' })
  nroComprobante?: string;

  @ApiPropertyOptional({
    example: 5,
    description:
      'Id del destino del gasto / categoría del ingreso (parametrica.destino_gasto), igual que en los detalles de un recibo. Debe ser un destino de EGRESO si tipo=DEPOSITO, o de INGRESO si tipo=RETIRO (según el `esEgreso` del destino). Se refleja tanto en el movimiento de la caja de flujo como en el de la libreta de bancos que genera el traspaso; en ambos queda excluido del resumen de "cuánto se gastó/ingresó" por destino (`/contabilidad/reportes/destino-gasto`), que es solo para gasto/ingreso real del negocio.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El destino del gasto no es válido.' })
  @IsPositive({ message: 'El destino del gasto no es válido.' })
  idDestinoGasto?: number;

  @ApiProperty({
    example: 'DEPÓSITO DE EFECTIVO DE CAJA PRINCIPAL A CTA BANCO UNIÓN',
    description: 'Concepto del traspaso (se guarda igual en ambos lados).',
  })
  @IsString({ message: 'El concepto debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'El concepto es obligatorio.' })
  @MaxLength(255, { message: 'El concepto no puede exceder los 255 caracteres.' })
  concepto: string;

  @ApiProperty({ example: 1000, description: 'Monto del traspaso (mayor a 0).' })
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El monto debe ser numérico con hasta 2 decimales.' },
  )
  @IsPositive({ message: 'El monto debe ser mayor a 0.' })
  monto: number;

  @ApiProperty({
    example: '7',
    description:
      'Id de la persona (persona_ci) que AUTORIZÓ el traspaso. Debe ser una persona con `autorizado = true` y activa (ver GET /comercio_interno/persona_ci/autorizadas). Se guarda como snapshot (id + nombres) en `personaAutorizo`. Al actualizar, si se envía el mismo id se conserva el snapshot original.',
  })
  @IsNotEmpty({ message: 'Debe indicar quién autorizó el traspaso (idPersonaAutorizo).' })
  @IsString({ message: 'El id de la persona que autorizó debe ser una cadena de texto.' })
  idPersonaAutorizo: string;
}
