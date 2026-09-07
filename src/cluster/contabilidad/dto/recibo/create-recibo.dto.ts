import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
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
import { ReciboDetalleDto } from './recibo-detalle.dto';

/**
 * Cuerpo del `POST /contabilidad/recibo`. Dos modos:
 *   - sin `detalles`: crea el recibo como BORRADOR (solo la cabecera, ya
 *     alcanza para imprimirlo). Se procesa después con
 *     `PATCH /contabilidad/recibo/:id/procesar`, o se anula con
 *     `PATCH /contabilidad/recibo/:id/anular`.
 *   - con `detalles`: crea el recibo y lo procesa en el mismo paso (queda
 *     PROCESADO), posteando de una vez las líneas de kardex y los
 *     movimientos de caja de flujo.
 * No admite actualizar un recibo ya PROCESADO (para corregir, se ajusta
 * directamente el movimiento de kardex/caja correspondiente).
 */
export class CreateReciboDto {
  @ApiProperty({
    enum: ['INGRESO', 'EGRESO'],
    example: 'EGRESO',
    description:
      'INGRESO (serie R) = dinero que entra. EGRESO (serie C) = dinero que sale. La serie la asigna el servidor.',
  })
  @IsIn(['INGRESO', 'EGRESO'], {
    message: 'El tipo debe ser INGRESO o EGRESO.',
  })
  tipo: 'INGRESO' | 'EGRESO';

  @ApiProperty({ example: '2026-09-03', description: 'Fecha del recibo (YYYY-MM-DD).' })
  @IsDateString({}, { message: 'La fecha debe tener el formato YYYY-MM-DD.' })
  fecha: string;

  @ApiProperty({
    example: 300000,
    description: 'Monto total del recibo (para la impresión). Debe ser igual a la suma de los montos de `detalles`.',
  })
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El monto total debe ser numérico con hasta 2 decimales.' },
  )
  @IsPositive({ message: 'El monto total debe ser mayor a 0.' })
  montoTotal: number;

  @ApiProperty({
    example: 'A CUENTA ANTICIPO INGENIO VILLA IMPERIAL',
    description: 'Concepto del recibo ("Por concepto").',
  })
  @IsString({ message: 'El concepto debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'El concepto es obligatorio.' })
  @MaxLength(255, { message: 'El concepto no puede exceder los 255 caracteres.' })
  concepto: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'Id de la forma de pago (Efectivo, QR, Transferencia, Cheque, Depósito...).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive({ message: 'La forma de pago no es válida.' })
  idFormaPago?: number;

  @ApiPropertyOptional({
    example: 1,
    description:
      'Id de la cuenta bancaria (parametrica.cuenta_bancaria) involucrada, cuando `idFormaPago` es un medio bancario (QR, Transferencia, Cheque, Depósito). Solo informativo del recibo: no genera un movimiento en la libreta de bancos.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive({ message: 'La cuenta bancaria no es válida.' })
  idCuentaBancaria?: number;

  @ApiPropertyOptional({
    example: '4613159797',
    description:
      'N° de comprobante de la transacción bancaria (QR, transferencia, cheque, depósito). Distinto del número del recibo (R-xxxx/C-xxxx), que lo asigna el servidor.',
  })
  @IsOptional()
  @IsString({ message: 'El N° de comprobante debe ser una cadena de texto.' })
  @MaxLength(30, { message: 'El N° de comprobante no puede exceder los 30 caracteres.' })
  nroComprobante?: string;

  @ApiPropertyOptional({
    example: '18',
    description:
      'Id de la persona registrada (persona_ci), contraparte física del recibo ("Recibí de" / "Entregué a"), cuando corresponde a UNA sola persona ya registrada. Excluyente con `idActorProductivoMinero`. Si no corresponde a una persona ni a un actor, dejar vacío y usar `nombresApellidos`. El destino real de cada porción (a quién se le salda la deuda) se indica en `detalles`, no acá.',
  })
  @IsOptional()
  @IsString({ message: 'El id de la persona debe ser una cadena de texto.' })
  idPersona?: string;

  @ApiPropertyOptional({
    example: '4',
    description:
      'Id del actor productivo minero, contraparte física del recibo, cuando corresponde a un actor (no a una persona puntual). Excluyente con `idPersona`.',
  })
  @IsOptional()
  @IsString({ message: 'El id del actor productivo minero debe ser una cadena de texto.' })
  idActorProductivoMinero?: string;

  @ApiPropertyOptional({
    example: 'JAVIER VARGAS - ROBERTO COLQUE',
    description:
      'Contraparte física del recibo en texto libre (uno o varios nombres, o alguien no registrado). Si se envía `idPersona` o `idActorProductivoMinero`, este texto es opcional: se completa con el nombre correspondiente.',
  })
  @IsOptional()
  @IsString({ message: 'El campo nombres y apellidos debe ser una cadena de texto.' })
  @MaxLength(255)
  nombresApellidos?: string;

  @ApiPropertyOptional({
    example: 8,
    description:
      'Id del destino del gasto (parametrica.destino_gasto), clasificador único aplicado tanto a las líneas de kardex como a los movimientos de caja de flujo que genera este recibo.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive({ message: 'El destino del gasto no es válido.' })
  idDestinoGasto?: number;

  @ApiPropertyOptional({
    type: [ReciboDetalleDto],
    description:
      'Cómo se subdivide el monto total entre kardex personal, kardex de actor productivo minero, y efectivo directo. La suma debe ser igual a `montoTotal`. Si se omite, el recibo queda como BORRADOR (solo cabecera) y se procesa después con `PATCH /contabilidad/recibo/:id/procesar`.',
    example: [
      { destino: 'PERSONAL', idPersona: '18', monto: 150000 },
      { destino: 'ACTOR', idActorProductivoMinero: '4', monto: 100000 },
      { destino: 'EFECTIVO', monto: 50000 },
    ],
  })
  @IsOptional()
  @IsArray({ message: 'Los detalles deben ser una lista.' })
  @ArrayMinSize(1, { message: 'El recibo debe tener al menos una línea de detalle.' })
  @ValidateNested({ each: true })
  @Type(() => ReciboDetalleDto)
  detalles?: ReciboDetalleDto[];
}
