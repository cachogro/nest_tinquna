import { ApiProperty, ApiPropertyOptional, IntersectionType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { DatosPagoDto } from '../prestamo-personal/datos-pago.dto';
import { DescuentoPrestamoDto } from './create-boleta-pago.dto';

const importe = (campo: string) =>
  IsNumber(
    { maxDecimalPlaces: 2 },
    { message: `${campo} debe ser numérico con hasta 2 decimales.` },
  );

/** Datos de pago comunes a aguinaldo, finiquito y retroactivo. */
export class PagoBoletaDto extends DatosPagoDto {
  @ApiProperty({ example: '2026-12-20', description: 'Fecha del recibo y de las líneas de kardex.' })
  @IsDateString({}, { message: 'La fecha de pago debe tener el formato YYYY-MM-DD.' })
  fechaPago: string;

  @ApiPropertyOptional({
    type: [DescuentoPrestamoDto],
    description:
      'Descuentos de préstamos (solo FINIQUITO y RETROACTIVO; el aguinaldo no admite descuentos). Si se omite, no se descuenta nada.',
  })
  @IsOptional()
  @IsArray({ message: 'Los descuentos deben ser una lista.' })
  @ValidateNested({ each: true })
  @Type(() => DescuentoPrestamoDto)
  descuentos?: DescuentoPrestamoDto[];

  @ApiPropertyOptional({ description: 'Concepto del recibo. Si se omite, se arma solo.' })
  @IsOptional()
  @IsString({ message: 'El concepto debe ser una cadena de texto.' })
  @MaxLength(150, { message: 'El concepto no puede exceder los 150 caracteres.' })
  concepto?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ message: 'Las observaciones deben ser una cadena de texto.' })
  @MaxLength(500, { message: 'Las observaciones no pueden exceder los 500 caracteres.' })
  observaciones?: string;
}

// ------------------------------------------------------------------ aguinaldo
export class CalcularAguinaldoDto {
  @ApiProperty({ example: '18' })
  @IsNotEmpty({ message: 'Debe indicar la persona (idPersona).' })
  @IsString({ message: 'El id de la persona debe ser una cadena de texto.' })
  idPersona: string;

  @ApiProperty({ example: 2026, description: 'Gestión del aguinaldo.' })
  @Type(() => Number)
  @IsInt({ message: 'La gestión debe ser un número entero.' })
  @Min(2000, { message: 'La gestión no es válida.' })
  gestion: number;

  @ApiPropertyOptional({
    example: 3795,
    description:
      'Promedio mensual a usar (Bs.). Si se omite: promedio del total ganado de las últimas boletas de SUELDO de la gestión (parámetro MESES_PROMEDIO_INDEMNIZACION).',
  })
  @IsOptional()
  @Type(() => Number)
  @importe('El promedio')
  @IsPositive({ message: 'El promedio debe ser mayor a 0.' })
  promedio?: number;

  @ApiPropertyOptional({
    example: 360,
    description: 'Días trabajados en la gestión (mes comercial de 30). Si se omite, se cuentan desde el ingreso.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Los días deben ser un número entero.' })
  @Min(1)
  @Max(360)
  diasTrabajados?: number;
}

export class EmitirAguinaldoDto extends IntersectionType(CalcularAguinaldoDto, PagoBoletaDto) {}

// ------------------------------------------------------------------ finiquito
export class OtroIngresoDto {
  @ApiProperty({ example: 'Sueldo pendiente 1 al 15 de octubre' })
  @IsString({ message: 'El nombre del ingreso debe ser una cadena de texto.' })
  @Length(2, 150, { message: 'El nombre del ingreso debe tener entre 2 y 150 caracteres.' })
  nombre: string;

  @ApiProperty({ example: 1650 })
  @Type(() => Number)
  @importe('El monto del ingreso')
  @IsPositive({ message: 'El monto del ingreso debe ser mayor a 0.' })
  monto: number;
}

/**
 * Cada rubro es opcional: solo se calcula si la persona tiene el check
 * (personal_planilla) Y el flag de acá no lo apaga.
 */
export class CalcularFiniquitoDto {
  @ApiProperty({ example: '18' })
  @IsNotEmpty({ message: 'Debe indicar la persona (idPersona).' })
  @IsString({ message: 'El id de la persona debe ser una cadena de texto.' })
  idPersona: string;

  @ApiProperty({ example: '2026-10-15', description: 'Último día trabajado.' })
  @IsDateString({}, { message: 'La fecha de retiro debe tener el formato YYYY-MM-DD.' })
  fechaRetiro: string;

  @ApiPropertyOptional({ example: 'RETIRO VOLUNTARIO' })
  @IsOptional()
  @IsString({ message: 'El motivo de retiro debe ser una cadena de texto.' })
  @MaxLength(100, { message: 'El motivo de retiro no puede exceder los 100 caracteres.' })
  motivoRetiro?: string;

  @ApiPropertyOptional({
    example: 3795,
    description: 'Promedio indemnizable (Bs.). Si se omite: promedio del total ganado de las últimas boletas de SUELDO.',
  })
  @IsOptional()
  @Type(() => Number)
  @importe('El promedio')
  @IsPositive({ message: 'El promedio debe ser mayor a 0.' })
  promedio?: number;

  @ApiPropertyOptional({ example: true, default: true, description: 'Indemnización por tiempo de servicio.' })
  @IsOptional()
  @IsBoolean()
  incluirIndemnizacion?: boolean;

  @ApiPropertyOptional({
    example: false,
    default: false,
    description: 'Desahucio (N sueldos): solo si se lo despide sin preaviso.',
  })
  @IsOptional()
  @IsBoolean()
  incluirDesahucio?: boolean;

  @ApiPropertyOptional({ example: true, default: true, description: 'Aguinaldo proporcional de la gestión.' })
  @IsOptional()
  @IsBoolean()
  incluirAguinaldo?: boolean;

  @ApiPropertyOptional({ example: true, default: true, description: 'Vacaciones pendientes.' })
  @IsOptional()
  @IsBoolean()
  incluirVacaciones?: boolean;

  @ApiPropertyOptional({
    example: 10,
    description: 'Días de vacación a pagar. Si se omite: saldo pendiente + proporcional del año en curso.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 1 }, { message: 'Los días de vacación deben tener hasta 1 decimal.' })
  @Min(0)
  diasVacacion?: number;

  @ApiPropertyOptional({ type: [OtroIngresoDto], description: 'Sueldo pendiente, bonos, etc.' })
  @IsOptional()
  @IsArray({ message: 'Los otros ingresos deben ser una lista.' })
  @ValidateNested({ each: true })
  @Type(() => OtroIngresoDto)
  otrosIngresos?: OtroIngresoDto[];
}

export class EmitirFiniquitoDto extends IntersectionType(CalcularFiniquitoDto, PagoBoletaDto) {
  @ApiPropertyOptional({
    example: true,
    default: true,
    description: 'Registrar la fecha de retiro como fin de labores en la ficha de la persona.',
  })
  @IsOptional()
  @IsBoolean()
  registrarRetiro?: boolean;
}

// ---------------------------------------------------------------- retroactivo
export class CalcularRetroactivoDto {
  @ApiProperty({ example: '18' })
  @IsNotEmpty({ message: 'Debe indicar la persona (idPersona).' })
  @IsString({ message: 'El id de la persona debe ser una cadena de texto.' })
  idPersona: string;

  @ApiProperty({
    example: '2026-01-01',
    description: 'Se toman las boletas de SUELDO cuyo fin de periodo cae entre fechaDesde y fechaHasta.',
  })
  @IsDateString({}, { message: 'La fecha desde debe tener el formato YYYY-MM-DD.' })
  fechaDesde: string;

  @ApiProperty({ example: '2026-04-30' })
  @IsDateString({}, { message: 'La fecha hasta debe tener el formato YYYY-MM-DD.' })
  fechaHasta: string;

  @ApiPropertyOptional({
    example: 3300,
    description:
      'Nuevo salario mensual. Si se omite, solo se recalcula el bono de antigüedad (por ejemplo, cuando subió el salario mínimo).',
  })
  @IsOptional()
  @Type(() => Number)
  @importe('El nuevo salario')
  @IsPositive({ message: 'El nuevo salario debe ser mayor a 0.' })
  nuevoSalario?: number;
}

export class EmitirRetroactivoDto extends IntersectionType(CalcularRetroactivoDto, PagoBoletaDto) {
  @ApiPropertyOptional({
    example: true,
    default: true,
    description: 'Guardar el nuevo salario como salario mensual de la persona.',
  })
  @IsOptional()
  @IsBoolean()
  actualizarSalario?: boolean;
}
