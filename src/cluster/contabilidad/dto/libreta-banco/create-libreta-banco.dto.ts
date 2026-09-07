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
 * Cuerpo único del `POST /contabilidad/libreta-banco`:
 * sin `id` registra un movimiento, con `id` lo actualiza.
 * El `saldo` no se envía: lo calcula el servicio.
 */
export class CreateLibretaBancoDto {
  @ApiPropertyOptional({
    description: 'Id del movimiento. Presente => actualizar; ausente => crear.',
    example: 15,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive({ message: 'El id del movimiento no es válido.' })
  id?: number;

  @ApiProperty({ example: 1, description: 'Id de la cuenta bancaria.' })
  @Type(() => Number)
  @IsInt({ message: 'La cuenta bancaria no es válida.' })
  @IsPositive({ message: 'La cuenta bancaria no es válida.' })
  idCuentaBancaria: number;

  @ApiProperty({ example: '2025-05-14', description: 'Fecha del movimiento (YYYY-MM-DD).' })
  @IsDateString({}, { message: 'La fecha debe tener el formato YYYY-MM-DD.' })
  fecha: string;

  @ApiPropertyOptional({
    example: '4478708896',
    description: 'N° de transacción del banco.',
  })
  @IsOptional()
  @IsString({ message: 'El N° de transacción debe ser una cadena de texto.' })
  @MaxLength(30, { message: 'El N° de transacción no puede exceder los 30 caracteres.' })
  nroTransaccion?: string;

  @ApiPropertyOptional({
    example: 'RENE MISQUE - ANDIA ROMAN PERALTA',
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
    example: 'ANTICIPO A CTA SACO MINERAL',
    description: 'Concepto del movimiento.',
  })
  @IsString({ message: 'El concepto debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'El concepto es obligatorio.' })
  @MaxLength(255, { message: 'El concepto no puede exceder los 255 caracteres.' })
  concepto: string;

  @ApiProperty({
    enum: ['DEBE', 'HABER'],
    example: 'DEBE',
    description: 'DEBE = salida / cargo (egreso). HABER = entrada / abono (ingreso, depósito).',
  })
  @IsIn(['DEBE', 'HABER'], {
    message: 'El tipo debe ser DEBE (salida) o HABER (entrada).',
  })
  tipo: 'DEBE' | 'HABER';

  @ApiProperty({ example: 2500, description: 'Monto del movimiento (mayor a 0).' })
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El monto debe ser numérico con hasta 2 decimales.' },
  )
  @IsPositive({ message: 'El monto debe ser mayor a 0.' })
  monto: number;
}
