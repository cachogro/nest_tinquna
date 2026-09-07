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
 * Cuerpo único del `POST /contabilidad/movimiento-caja`:
 * sin `id` registra un movimiento, con `id` lo actualiza.
 * El `saldo` no se envía: lo calcula el servicio, por separado para cada moneda.
 */
export class CreateMovimientoCajaDto {
  @ApiPropertyOptional({
    description: 'Id del movimiento. Presente => actualizar; ausente => crear.',
    example: 15,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive({ message: 'El id del movimiento no es válido.' })
  id?: number;

  @ApiProperty({ example: 1, description: 'Id de la caja.' })
  @Type(() => Number)
  @IsInt({ message: 'La caja no es válida.' })
  @IsPositive({ message: 'La caja no es válida.' })
  idCaja: number;

  @ApiProperty({
    enum: ['BOB', 'USD'],
    example: 'BOB',
    description: 'Moneda del movimiento.',
  })
  @IsIn(['BOB', 'USD'], { message: 'La moneda debe ser BOB o USD.' })
  moneda: 'BOB' | 'USD';

  @ApiProperty({ example: '2025-07-01', description: 'Fecha del movimiento (YYYY-MM-DD).' })
  @IsDateString({}, { message: 'La fecha debe tener el formato YYYY-MM-DD.' })
  fecha: string;

  @ApiPropertyOptional({
    example: 'REC:R-0009',
    description: 'N° de comprobante (factura y/o recibo).',
  })
  @IsOptional()
  @IsString({ message: 'El N° de comprobante debe ser una cadena de texto.' })
  @MaxLength(30, { message: 'El N° de comprobante no puede exceder los 30 caracteres.' })
  nroComprobante?: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'Id de la forma de pago (EFECTIVO, QR, CHEQUE...).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La forma de pago no es válida.' })
  @IsPositive({ message: 'La forma de pago no es válida.' })
  idFormaPago?: number;

  @ApiPropertyOptional({
    example: 'RAFAEL DOUCHEN',
    description:
      'Beneficiario / contraparte del movimiento (texto libre). Si se envía `idPersona`, este texto es opcional: se completa con el nombre de la persona.',
  })
  @IsOptional()
  @IsString({ message: 'El campo nombres y apellidos debe ser una cadena de texto.' })
  @MaxLength(255)
  nombresApellidos?: string;

  @ApiPropertyOptional({
    example: '15',
    description:
      'Id de la persona registrada (persona_ci) cuando el beneficiario ya existe en el sistema. Si no está en la lista, dejar vacío y usar solo `nombresApellidos`.',
  })
  @IsOptional()
  @IsString({ message: 'El id de la persona debe ser una cadena de texto.' })
  idPersona?: string;

  @ApiProperty({
    example: 'VENTA DE DIESEL DE 400 LTRS. A 7.-BS DEL GALPON DE ARRIBA',
    description: 'Concepto del movimiento.',
  })
  @IsString({ message: 'El concepto debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'El concepto es obligatorio.' })
  @MaxLength(255, { message: 'El concepto no puede exceder los 255 caracteres.' })
  concepto: string;

  @ApiPropertyOptional({
    example: 2,
    description: 'Id del destino del gasto o categoría del ingreso (parametrica.destino_gasto).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El destino del gasto no es válido.' })
  @IsPositive({ message: 'El destino del gasto no es válido.' })
  idDestinoGasto?: number;

  @ApiProperty({
    enum: ['INGRESO', 'EGRESO'],
    example: 'EGRESO',
    description: 'INGRESO = entrada de efectivo. EGRESO = salida de efectivo.',
  })
  @IsIn(['INGRESO', 'EGRESO'], {
    message: 'El tipo debe ser INGRESO o EGRESO.',
  })
  tipo: 'INGRESO' | 'EGRESO';

  @ApiProperty({ example: 2800, description: 'Monto del movimiento (mayor a 0).' })
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El monto debe ser numérico con hasta 2 decimales.' },
  )
  @IsPositive({ message: 'El monto debe ser mayor a 0.' })
  monto: number;
}
