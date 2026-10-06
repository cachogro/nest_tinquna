import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export const DESTINOS_KARDEX_PAGO = ['PERSONAL', 'ACTOR', 'CLIENTE'] as const;
export type DestinoKardexPago = (typeof DESTINOS_KARDEX_PAGO)[number];

/** Dueño de un kardex ABIERTO: persona (PERSONAL o ASOCIADO), actor o cliente. */
export class KardexDestinoDto {
  @ApiProperty({
    enum: DESTINOS_KARDEX_PAGO,
    description:
      'PERSONAL = persona (su kardex PERSONAL o ASOCIADO), ACTOR = actor productivo, CLIENTE = cliente.',
  })
  @IsIn(DESTINOS_KARDEX_PAGO, { message: 'El destino del kardex no es válido.' })
  destino: DestinoKardexPago;

  @ApiPropertyOptional({ example: '15' })
  @IsOptional()
  @IsString()
  idPersona?: string;

  @ApiPropertyOptional({ example: '5' })
  @IsOptional()
  @IsString()
  idActorProductivoMinero?: string;

  @ApiPropertyOptional({ example: '2' })
  @IsOptional()
  @IsString()
  idCliente?: string;
}

/** Parte del líquido pagable que el proveedor deja a un kardex (HABER). */
export class AbonoKardexDto extends KardexDestinoDto {
  @ApiProperty({ example: 50, description: '> 0, hasta 2 decimales.' })
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El monto del abono debe tener hasta 2 decimales.' },
  )
  @IsPositive({ message: 'El monto del abono debe ser mayor a cero.' })
  monto: number;
}

export class CreatePagoValorizacionDto {
  @ApiProperty({ example: '12', description: 'Valorización VALORIZADA a pagar.' })
  @IsString()
  @IsNotEmpty({ message: 'La valorización es obligatoria.' })
  idValorizacionMineral: string;

  @ApiProperty({ example: '2026-10-02' })
  @IsDateString({}, { message: 'La fecha del pago no es válida.' })
  fecha: string;

  @ApiPropertyOptional({
    example: 1,
    description:
      'Obligatoria si queda algo por pagar (líquido − abonos > 0). Efectivo sale de la caja de flujo; un medio bancario, de la libreta.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive({ message: 'La forma de pago no es válida.' })
  idFormaPago?: number;

  @ApiPropertyOptional({
    example: 1,
    description: 'Obligatoria con forma de pago bancaria.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive({ message: 'La cuenta bancaria no es válida.' })
  idCuentaBancaria?: number;

  @ApiPropertyOptional({
    example: '4613159797',
    description: 'N° de la transacción bancaria. Obligatorio con forma de pago bancaria.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(30, {
    message: 'El N° de comprobante no puede exceder los 30 caracteres.',
  })
  nroComprobante?: string;

  @ApiPropertyOptional({ example: 12, description: 'Destino del gasto (de egreso).' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive({ message: 'El destino del gasto no es válido.' })
  idDestinoGasto?: number;

  @ApiProperty({
    example: '7',
    description: 'Persona con `autorizado = true` que autorizó el pago.',
  })
  @IsString()
  @IsNotEmpty({ message: 'Debe indicar quién autorizó el pago (idPersonaAutorizo).' })
  idPersonaAutorizo: string;

  @ApiPropertyOptional({
    type: [AbonoKardexDto],
    description:
      'Opcional: montos del líquido pagable que se dejan a kardex (HABER). La suma no puede superar el líquido; el resto es lo que se paga.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AbonoKardexDto)
  abonos?: AbonoKardexDto[];

  @ApiPropertyOptional({
    type: KardexDestinoDto,
    description:
      'Obligatorio si la valorización tiene "otros anticipos": kardex donde se cancelan (HABER), porque ya se descontaron del líquido.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => KardexDestinoDto)
  kardexOtrosAnticipos?: KardexDestinoDto;
}
