import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { DatosPagoDto } from '../prestamo-personal/datos-pago.dto';

const importeOpcional = (campo: string) =>
  IsNumber(
    { maxDecimalPlaces: 2 },
    { message: `${campo} debe ser numérico con hasta 2 decimales.` },
  );

export class DescuentoPrestamoDto {
  @ApiProperty({ example: '3', description: 'Id del préstamo VIGENTE de la persona.' })
  @IsNotEmpty({ message: 'Debe indicar el préstamo (idPrestamo).' })
  @IsString({ message: 'El id del préstamo debe ser una cadena de texto.' })
  idPrestamo: string;

  @ApiProperty({
    example: 1000,
    description:
      'Monto a descontar este mes (Bs.). Puede ser más, menos o igual a la cuota pactada; 0 = no descontar. No puede superar el saldo del préstamo.',
  })
  @Type(() => Number)
  @importeOpcional('El monto del descuento')
  @Min(0, { message: 'El monto del descuento no puede ser negativo.' })
  monto: number;
}

/**
 * Cuerpo del `POST /contabilidad/boleta-pago`: emite y paga, en un solo
 * paso, la boleta de sueldo de un empleado.
 *
 *   totalGanado    = salarioBase + bonoAntiguedad + otrosIngresos
 *   liquidoPagable = totalGanado - (aporteLaboral + rcIva + otrosDescuentosLey)
 *   montoPagado    = liquidoPagable - suma(descuentos)
 *
 * Genera un recibo de EGRESO solo por `montoPagado` (si es > 0). Cada
 * descuento baja el kardex PERSONAL (HABER sin movimiento de caja/banco) y
 * el sub-libro de su préstamo.
 */
export class CreateBoletaPagoDto extends DatosPagoDto {
  @ApiProperty({ example: '18', description: 'Id de la persona (personal de la empresa).' })
  @IsNotEmpty({ message: 'Debe indicar la persona (idPersona).' })
  @IsString({ message: 'El id de la persona debe ser una cadena de texto.' })
  idPersona: string;

  @ApiProperty({ example: '2026-02-28', description: 'Inicio del periodo pagado (YYYY-MM-DD).' })
  @IsDateString({}, { message: 'La fecha desde debe tener el formato YYYY-MM-DD.' })
  fechaDesde: string;

  @ApiProperty({ example: '2026-03-28', description: 'Fin del periodo pagado (YYYY-MM-DD).' })
  @IsDateString({}, { message: 'La fecha hasta debe tener el formato YYYY-MM-DD.' })
  fechaHasta: string;

  @ApiProperty({
    example: '2026-03-28',
    description: 'Fecha en que se paga: es la fecha del recibo y de las líneas de kardex.',
  })
  @IsDateString({}, { message: 'La fecha de pago debe tener el formato YYYY-MM-DD.' })
  fechaPago: string;

  @ApiPropertyOptional({ example: 30, description: 'Días trabajados (informativo).' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Los días trabajados deben ser un número entero.' })
  @Min(0)
  @Max(31)
  diasTrabajados?: number;

  @ApiPropertyOptional({
    example: 3500,
    description: 'Salario base del periodo (Bs.). Si se omite, se usa el salario mensual registrado de la persona.',
  })
  @IsOptional()
  @Type(() => Number)
  @importeOpcional('El salario base')
  @IsPositive({ message: 'El salario base debe ser mayor a 0.' })
  salarioBase?: number;

  @ApiPropertyOptional({ example: 0, default: 0, description: 'Bono de antigüedad (Bs.).' })
  @IsOptional()
  @Type(() => Number)
  @importeOpcional('El bono de antigüedad')
  @Min(0)
  bonoAntiguedad?: number;

  @ApiPropertyOptional({ example: 0, default: 0, description: 'Otros ingresos: horas extra, bonos (Bs.).' })
  @IsOptional()
  @Type(() => Number)
  @importeOpcional('Otros ingresos')
  @Min(0)
  otrosIngresos?: number;

  @ApiPropertyOptional({ example: 0, default: 0, description: 'Aporte laboral a la Gestora / AFP (Bs.).' })
  @IsOptional()
  @Type(() => Number)
  @importeOpcional('El aporte laboral')
  @Min(0)
  aporteLaboral?: number;

  @ApiPropertyOptional({ example: 0, default: 0, description: 'RC-IVA retenido (Bs.).' })
  @IsOptional()
  @Type(() => Number)
  @importeOpcional('El RC-IVA')
  @Min(0)
  rcIva?: number;

  @ApiPropertyOptional({ example: 0, default: 0, description: 'Otros descuentos de ley (Bs.).' })
  @IsOptional()
  @Type(() => Number)
  @importeOpcional('Otros descuentos de ley')
  @Min(0)
  otrosDescuentosLey?: number;

  @ApiPropertyOptional({
    type: [DescuentoPrestamoDto],
    description:
      'Cuánto descontar de cada préstamo VIGENTE este mes. Si se OMITE, se descuenta la cuota pactada de cada préstamo vigente (o su saldo, si es menor). Si se envía (aunque sea []), se aplica tal cual: los préstamos que no figuren no se descuentan. La suma no puede superar el líquido pagable.',
    example: [{ idPrestamo: '3', monto: 1500 }],
  })
  @IsOptional()
  @IsArray({ message: 'Los descuentos deben ser una lista.' })
  @ValidateNested({ each: true })
  @Type(() => DescuentoPrestamoDto)
  descuentos?: DescuentoPrestamoDto[];

  @ApiPropertyOptional({
    example: 'Pago de sueldos y salarios - 28 Febrero a 28 Marzo 2026',
    description:
      'Concepto del recibo y de las líneas de kardex. Si se omite: "Pago de sueldos y salarios - <periodo>".',
  })
  @IsOptional()
  @IsString({ message: 'El concepto debe ser una cadena de texto.' })
  @MaxLength(150, { message: 'El concepto no puede exceder los 150 caracteres.' })
  concepto?: string;

  @ApiPropertyOptional({ example: 'EL EMPLEADO PIDIÓ DESCONTAR MÁS ESTE MES.' })
  @IsOptional()
  @IsString({ message: 'Las observaciones deben ser una cadena de texto.' })
  @MaxLength(500, { message: 'Las observaciones no pueden exceder los 500 caracteres.' })
  observaciones?: string;
}
