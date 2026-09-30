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

  @ApiPropertyOptional({
    enum: ['BS', 'USD'],
    default: 'BS',
    example: 'BS',
    description:
      'Moneda del recibo: `montoTotal` y los montos de `detalles` van en esta moneda. En USD, la caja (efectivo) o la cuenta bancaria deben ser en USD, y las líneas de kardex se postean convertidas a Bs. con `tipoCambio`. Por defecto BS.',
  })
  @IsOptional()
  @IsIn(['BS', 'USD'], { message: 'La moneda debe ser BS o USD.' })
  moneda?: 'BS' | 'USD';

  @ApiPropertyOptional({
    example: 6.96,
    description: 'Tipo de cambio (Bs. por 1 USD). Obligatorio si `moneda` = USD; se ignora en BS.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 4 },
    { message: 'El tipo de cambio debe ser numérico con hasta 4 decimales.' },
  )
  @IsPositive({ message: 'El tipo de cambio debe ser mayor a 0.' })
  tipoCambio?: number;

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
      'Id de la cuenta bancaria (parametrica.cuenta_bancaria) involucrada. Obligatorio si `idFormaPago` es un medio bancario (QR, Transferencia, Cheque, Depósito) — se valida y se guarda ya en la cabecera, aunque el recibo quede BORRADOR. No genera todavía un movimiento en la libreta de bancos (eso pasa al procesar).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive({ message: 'La cuenta bancaria no es válida.' })
  idCuentaBancaria?: number;

  @ApiPropertyOptional({
    example: '4613159797',
    description:
      'N° de comprobante de la transacción bancaria (QR, transferencia, cheque, depósito). Obligatorio si `idFormaPago` es un medio bancario. Distinto del número del recibo (R-xxxx/C-xxxx), que lo asigna el servidor.',
  })
  @IsOptional()
  @IsString({ message: 'El N° de comprobante debe ser una cadena de texto.' })
  @MaxLength(30, { message: 'El N° de comprobante no puede exceder los 30 caracteres.' })
  nroComprobante?: string;

  @ApiPropertyOptional({
    example: '18',
    description:
      'Id de la persona registrada (persona_ci), contraparte física del recibo ("Recibí de" / "Entregué a"), cuando corresponde a UNA sola persona ya registrada. Excluyente con `idActorProductivoMinero`/`idCliente`. Si no corresponde a una persona ni a un actor ni a un cliente, dejar vacío y usar `nombresApellidos`. El destino real de cada porción (a quién se le salda la deuda) se indica en `detalles`, no acá.',
  })
  @IsOptional()
  @IsString({ message: 'El id de la persona debe ser una cadena de texto.' })
  idPersona?: string;

  @ApiPropertyOptional({
    example: '4',
    description:
      'Id del actor productivo minero (proveedor), contraparte física del recibo, cuando corresponde a un actor (no a una persona puntual). Excluyente con `idPersona`/`idCliente`.',
  })
  @IsOptional()
  @IsString({ message: 'El id del actor productivo minero debe ser una cadena de texto.' })
  idActorProductivoMinero?: string;

  @ApiPropertyOptional({
    example: '3',
    description:
      'Id del cliente/comprador, contraparte física del recibo (por ejemplo, cobro de una venta). Excluyente con `idPersona`/`idActorProductivoMinero`.',
  })
  @IsOptional()
  @IsString({ message: 'El id del cliente debe ser una cadena de texto.' })
  idCliente?: string;

  @ApiProperty({
    example: '7',
    description:
      'Id de la persona (persona_ci) que AUTORIZÓ generar este recibo. Distinto de `idPersona` (esa es la contraparte del recibo). Debe ser una persona con `autorizado = true` y activa (ver GET /comercio_interno/persona_ci/autorizadas).',
  })
  @IsNotEmpty({ message: 'Debe indicar quién autorizó el recibo (idPersonaAutorizo).' })
  @IsString({ message: 'El id de la persona que autorizó debe ser una cadena de texto.' })
  idPersonaAutorizo: string;

  @ApiPropertyOptional({
    example: '25',
    description:
      'Id de la recepción de mineral de la que proviene este recibo (anticipo). Solo para recibos EGRESO: el monto debe ser igual al anticipo de la recepción y la recepción no puede tener otro recibo vigente (BORRADOR/PROCESADO). Un recibo ANULADO libera la recepción.',
  })
  @IsOptional()
  @IsString({ message: 'El id de la recepción debe ser una cadena de texto.' })
  idRecepcionMineral?: string;

  @ApiPropertyOptional({
    example: '15',
    description:
      'Id de la valorización cuyo saldo (Líquido Pagable) paga este recibo. Solo para recibos EGRESO en Bs.: la valorización debe estar VALORIZADA, el monto debe ser igual a su totalValorLiquidoVentaBolivianos y no puede tener otro recibo vigente (BORRADOR/PROCESADO). Un recibo ANULADO la libera. No se combina con idRecepcionMineral.',
  })
  @IsOptional()
  @IsString({ message: 'El id de la valorización debe ser una cadena de texto.' })
  idValorizacionMineral?: string;

  @ApiPropertyOptional({
    example: '4',
    description:
      'Id de la venta de lote que cobra este recibo (anticipo o pago del comprador). Solo INGRESO, con el cliente de la venta como contraparte (`idCliente`); la venta no puede estar ANULADA. Si ya está LIQUIDADA, el recibo no puede superar lo que falta cobrar. Puede haber varios recibos por venta. No se combina con idRecepcionMineral ni idValorizacionMineral.',
  })
  @IsOptional()
  @IsString({ message: 'El id de la venta de lote debe ser una cadena de texto.' })
  idVentaLote?: string;

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
    type: [ReciboDetalleDto],
    description:
      'Cómo se subdivide el monto total entre kardex personal, kardex de actor productivo minero, y efectivo directo. La suma debe ser igual a `montoTotal`. Cada línea puede tener su propio `idDestinoGasto` y genera su propio movimiento de caja de flujo. Si se omite, el recibo queda como BORRADOR (solo cabecera) y se procesa después con `PATCH /contabilidad/recibo/:id/procesar`.',
    example: [
      { destino: 'PERSONAL', idPersona: '18', monto: 150000, idDestinoGasto: 8 },
      { destino: 'ACTOR', idActorProductivoMinero: '4', monto: 100000, idDestinoGasto: 12 },
      { destino: 'EFECTIVO', monto: 50000, idDestinoGasto: 3 },
    ],
  })
  @IsOptional()
  @IsArray({ message: 'Los detalles deben ser una lista.' })
  @ArrayMinSize(1, { message: 'El recibo debe tener al menos una línea de detalle.' })
  @ValidateNested({ each: true })
  @Type(() => ReciboDetalleDto)
  detalles?: ReciboDetalleDto[];
}
