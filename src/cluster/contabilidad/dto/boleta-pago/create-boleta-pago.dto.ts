import { ApiProperty, ApiPropertyOptional, PickType } from '@nestjs/swagger';
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
 *   montoHorasExtra  = horasExtra × valorHoraExtra; montoDominicales = diasDominicales × valorDominical
 *   totalGanado    = salarioBase + bonoAntiguedad + montoHorasExtra + montoDominicales + otrosIngresos
 *                    + montoBeneficios (lactancia, natalidad... asignados a la persona)
 *   liquidoPagable = totalGanado - (aporteLaboral + rcIva + otrosDescuentosLey)
 *   montoPagado    = liquidoPagable - suma(descuentos)
 *
 * Cada importe es OPCIONAL: si se envía, se usa tal cual (a mano); si se
 * omite, se calcula con la configuración de sueldos de la persona
 * (personal_planilla) y del panel de paramétricas. Sin configuración de la
 * persona, lo omitido queda en 0 (salvo el salario básico).
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

  @ApiProperty({
    example: '2026-03-28',
    description: 'Fin del periodo pagado (YYYY-MM-DD). La antigüedad para el bono se cuenta hasta esta fecha.',
  })
  @IsDateString({}, { message: 'La fecha hasta debe tener el formato YYYY-MM-DD.' })
  fechaHasta: string;

  @ApiProperty({
    example: '2026-03-28',
    description: 'Fecha en que se paga: es la fecha del recibo y de las líneas de kardex.',
  })
  @IsDateString({}, { message: 'La fecha de pago debe tener el formato YYYY-MM-DD.' })
  fechaPago: string;

  @ApiPropertyOptional({
    example: 30,
    description:
      'Días trabajados. Si se omite, el mes completo (parámetro DIAS_MES, 30). El salario básico y el bono de antigüedad calculados son proporcionales a los días.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Los días trabajados deben ser un número entero.' })
  @Min(0)
  @Max(31)
  diasTrabajados?: number;

  @ApiPropertyOptional({
    example: 3500,
    description:
      'Salario básico del periodo (Bs.). Si se omite: salario mensual registrado de la persona / 30 * días trabajados.',
  })
  @IsOptional()
  @Type(() => Number)
  @importeOpcional('El salario base')
  @IsPositive({ message: 'El salario base debe ser mayor a 0.' })
  salarioBase?: number;

  @ApiPropertyOptional({
    example: 495,
    description:
      'Bono de antigüedad (Bs.). Si se omite y la persona tiene el check, se calcula: % de la escala por años cumplidos * (N salarios mínimos), proporcional a los días.',
  })
  @IsOptional()
  @Type(() => Number)
  @importeOpcional('El bono de antigüedad')
  @Min(0)
  bonoAntiguedad?: number;

  @ApiPropertyOptional({
    example: 6,
    default: 0,
    description: 'Cantidad de horas extra del periodo (las acuerda el encargado; no depende del control de asistencia). Se pagan solo con valorHoraExtra.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Las horas extra deben ser numéricas con hasta 2 decimales.' })
  @Min(0)
  horasExtra?: number;

  @ApiPropertyOptional({
    example: 25,
    description:
      'Cuánto vale cada hora extra (Bs.). Importe = horasExtra × valorHoraExtra. Sin este valor las horas no se pagan (y no se puede emitir con horas > 0).',
  })
  @IsOptional()
  @Type(() => Number)
  @importeOpcional('El valor de la hora extra')
  @Min(0)
  valorHoraExtra?: number;

  @ApiPropertyOptional({
    example: 150,
    description: 'Importe total de horas extra a mano (Bs.). Solo por compatibilidad: si se envía, manda sobre horasExtra × valorHoraExtra.',
  })
  @IsOptional()
  @Type(() => Number)
  @importeOpcional('El monto de horas extra')
  @Min(0)
  montoHorasExtra?: number;

  @ApiPropertyOptional({
    example: 4,
    default: 0,
    description: 'Domingos trabajados en el periodo (dominicales). Se pagan solo con valorDominical.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Los días dominicales deben ser numéricos con hasta 2 decimales.' })
  @Min(0, { message: 'Los días dominicales no pueden ser negativos.' })
  diasDominicales?: number;

  @ApiPropertyOptional({
    example: 110,
    description:
      'Cuánto vale cada dominical (Bs.). Importe = diasDominicales × valorDominical. Sin este valor no se pagan (y no se puede emitir con domingos > 0).',
  })
  @IsOptional()
  @Type(() => Number)
  @importeOpcional('El valor del dominical')
  @Min(0, { message: 'El valor del dominical no puede ser negativo.' })
  valorDominical?: number;

  @ApiPropertyOptional({
    example: 440,
    description: 'Importe total de dominicales a mano (Bs.). Solo por compatibilidad: si se envía, manda sobre diasDominicales × valorDominical.',
  })
  @IsOptional()
  @Type(() => Number)
  @importeOpcional('El monto de dominicales')
  @Min(0, { message: 'El monto de dominicales no puede ser negativo.' })
  montoDominicales?: number;

  @ApiPropertyOptional({ example: 0, default: 0, description: 'Otros ingresos: bonos, comisiones (Bs.).' })
  @IsOptional()
  @Type(() => Number)
  @importeOpcional('Otros ingresos')
  @Min(0)
  otrosIngresos?: number;

  @ApiPropertyOptional({
    example: true,
    default: true,
    description:
      'Pagar los beneficios asignados a la persona que tocan en el mes de fechaHasta (lactancia, natalidad...): una cuota completa de cada uno, sin prorratear. false = no se pagan en esta boleta.',
  })
  @IsOptional()
  @IsBoolean({ message: 'incluirBeneficios debe ser verdadero o falso.' })
  incluirBeneficios?: boolean;

  @ApiPropertyOptional({
    example: 444.85,
    description:
      'Total de descuentos laborales (Gestora, aporte solidario...). Si se omite, se calcula con los conceptos marcados de la persona y queda el detalle línea por línea; si se envía, se usa ese total sin detalle.',
  })
  @IsOptional()
  @Type(() => Number)
  @importeOpcional('El aporte laboral')
  @Min(0)
  aporteLaboral?: number;

  @ApiPropertyOptional({
    example: 0,
    default: 0,
    description: 'RC-IVA (Bs.). La empresa no es agente de retención: se ingresa a mano solo si corresponde.',
  })
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
    example: true,
    default: false,
    description:
      'Descontar los atrasos, salidas antes de hora y faltas SIN justificar del periodo (solo personas con control de asistencia). false = no se descuentan (por ejemplo, presentó justificativo).',
  })
  @IsOptional()
  @IsBoolean({ message: 'descontarAtrasos debe ser verdadero o falso.' })
  descontarAtrasos?: boolean;

  @ApiPropertyOptional({
    example: 45.5,
    description: 'Monto de atrasos a mano (Bs.). Si se envía, se usa este en lugar del calculado.',
  })
  @IsOptional()
  @Type(() => Number)
  @importeOpcional('El descuento de atrasos')
  @Min(0)
  descuentoAtrasos?: number;

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

/**
 * Cuerpo del `POST /contabilidad/boleta-pago/calcular`: los mismos importes
 * que la boleta, sin datos de pago. No guarda nada.
 */
export class CalcularBoletaPagoDto extends PickType(CreateBoletaPagoDto, [
  'idPersona',
  'fechaDesde',
  'fechaHasta',
  'diasTrabajados',
  'salarioBase',
  'bonoAntiguedad',
  'horasExtra',
  'valorHoraExtra',
  'montoHorasExtra',
  'diasDominicales',
  'valorDominical',
  'montoDominicales',
  'otrosIngresos',
  'incluirBeneficios',
  'aporteLaboral',
  'rcIva',
  'otrosDescuentosLey',
  'descontarAtrasos',
  'descuentoAtrasos',
] as const) {}
