import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
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
import { ChecksPlanillaDto } from 'src/cluster/parametricas/dto/planilla/guardar-tipo-contrato.dto';

/**
 * Body del `POST /contabilidad/personal-planilla`: crea o actualiza la
 * configuración de sueldo de una persona (una por persona).
 *
 * Al crear, los checks e `idsConceptos` que no se envíen se copian del tipo
 * de contrato (si se indica). Al actualizar, lo que no se envía no cambia;
 * `usarDefectosContrato: true` vuelve a copiar todo del tipo de contrato.
 */
export class GuardarPersonalPlanillaDto extends ChecksPlanillaDto {
  @ApiProperty({ example: '18', description: 'Id de la persona (personal de la empresa).' })
  @IsNotEmpty({ message: 'Debe indicar la persona (idPersona).' })
  @IsString({ message: 'El id de la persona debe ser una cadena de texto.' })
  idPersona: string;

  @ApiPropertyOptional({ example: 1, description: 'Tipo de contrato. null = sin tipo.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive({ message: 'El tipo de contrato no es válido.' })
  idTipoContrato?: number | null;

  @ApiPropertyOptional({
    example: false,
    description: 'true = copiar del tipo de contrato todos los checks y conceptos (ignora los enviados).',
  })
  @IsOptional()
  @IsBoolean()
  usarDefectosContrato?: boolean;

  @ApiPropertyOptional({ example: 'CONTADOR' })
  @IsOptional()
  @IsString({ message: 'El cargo debe ser una cadena de texto.' })
  @MaxLength(100, { message: 'El cargo no puede exceder los 100 caracteres.' })
  cargo?: string;

  @ApiPropertyOptional({ example: '41234567', description: 'NUA/CUA de la Gestora.' })
  @IsOptional()
  @IsString({ message: 'El NUA/CUA debe ser una cadena de texto.' })
  @MaxLength(30, { message: 'El NUA/CUA no puede exceder los 30 caracteres.' })
  nuaCua?: string;

  @ApiPropertyOptional({ example: '85-0412-ABC', description: 'Matrícula del asegurado en la CNS.' })
  @IsOptional()
  @IsString({ message: 'La matrícula CNS debe ser una cadena de texto.' })
  @MaxLength(30, { message: 'La matrícula CNS no puede exceder los 30 caracteres.' })
  matriculaCns?: string;

  @ApiPropertyOptional({
    example: [1, 2, 3, 4, 8, 9, 10, 11],
    type: [Number],
    description: 'Descuentos y aportes que se le calculan (reemplaza la lista).',
  })
  @IsOptional()
  @IsArray({ message: 'Los conceptos deben ser una lista de ids.' })
  @Type(() => Number)
  @IsInt({ each: true, message: 'Cada concepto debe ser un id numérico.' })
  idsConceptos?: number[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ message: 'Las observaciones deben ser una cadena de texto.' })
  @MaxLength(500, { message: 'Las observaciones no pueden exceder los 500 caracteres.' })
  observaciones?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Marca asistencia (ingreso, almuerzo, salida) y se le pueden descontar atrasos. false para el personal de ruta.',
  })
  @IsOptional()
  @IsBoolean({ message: 'controlaAsistencia debe ser verdadero o falso.' })
  controlaAsistencia?: boolean;

  @ApiPropertyOptional({ example: false, description: 'La boleta de sueldo pide RC-IVA (a mano). Sin esto no aparece.' })
  @IsOptional()
  @IsBoolean({ message: 'aplicaRcIva debe ser verdadero o falso.' })
  aplicaRcIva?: boolean;

  @ApiPropertyOptional({ example: false, description: 'La boleta de sueldo pide "otros descuentos de ley" (a mano). Sin esto no aparece.' })
  @IsOptional()
  @IsBoolean({ message: 'aplicaOtrosDescuentosLey debe ser verdadero o falso.' })
  aplicaOtrosDescuentosLey?: boolean;

  @ApiPropertyOptional({ example: 1, description: 'Horario de trabajo (obligatorio si controla asistencia). null = sin horario.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive({ message: 'El horario no es válido.' })
  idHorarioTrabajo?: number | null;
}

/** Body del `POST /contabilidad/vacacion`. */
export class RegistrarVacacionDto {
  @ApiProperty({ example: '18' })
  @IsNotEmpty({ message: 'Debe indicar la persona (idPersona).' })
  @IsString({ message: 'El id de la persona debe ser una cadena de texto.' })
  idPersona: string;

  @ApiProperty({
    enum: ['TOMADA', 'AJUSTE'],
    description: 'TOMADA = días que salió de vacación. AJUSTE = saldo inicial o corrección (puede ser negativo).',
  })
  @IsIn(['TOMADA', 'AJUSTE'], { message: 'El tipo debe ser TOMADA o AJUSTE.' })
  tipo: 'TOMADA' | 'AJUSTE';

  @ApiProperty({ example: '2026-11-02' })
  @IsDateString({}, { message: 'La fecha desde debe tener el formato YYYY-MM-DD.' })
  fechaDesde: string;

  @ApiPropertyOptional({ example: '2026-11-13' })
  @IsOptional()
  @IsDateString({}, { message: 'La fecha hasta debe tener el formato YYYY-MM-DD.' })
  fechaHasta?: string;

  @ApiProperty({ example: 10, description: 'Días hábiles (hasta 1 decimal). En AJUSTE puede ser negativo.' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 1 }, { message: 'Los días deben tener hasta 1 decimal.' })
  dias: number;

  @ApiPropertyOptional({ example: 'VACACIÓN GESTIÓN 2025' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observaciones?: string;
}

export class FiltroVacacionDto {
  @ApiPropertyOptional({ example: '2026-10-14', description: 'Fecha a la que se calcula el saldo. Por defecto, hoy.' })
  @IsOptional()
  @IsDateString({}, { message: 'La fecha debe tener el formato YYYY-MM-DD.' })
  fecha?: string;
}

/** Motivos sugeridos en la pantalla; el campo admite cualquier texto. */
export const MOTIVOS_RETIRO = [
  'RENUNCIA',
  'DESPIDO',
  'CONCLUSIÓN DE CONTRATO',
  'ABANDONO DE TRABAJO',
  'JUBILACIÓN',
  'FALLECIMIENTO',
  'OTRO',
] as const;

/**
 * Body del `POST /contabilidad/personal-planilla/:idPersona/retiro`: registra
 * la baja (último día trabajado y motivo). Admite fecha pasada, para cuando
 * la baja se acuerda días después.
 */
export class RegistrarRetiroDto {
  @ApiProperty({ example: '2026-10-15', description: 'Último día trabajado.' })
  @IsDateString({}, { message: 'La fecha de retiro debe tener el formato YYYY-MM-DD.' })
  fechaRetiro: string;

  @ApiProperty({ example: 'DESPIDO', description: `Sugeridos: ${MOTIVOS_RETIRO.join(', ')}.` })
  @IsString({ message: 'El motivo de retiro debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'Indica el motivo del retiro.' })
  @MaxLength(100, { message: 'El motivo de retiro no puede exceder los 100 caracteres.' })
  motivoRetiro: string;

  @ApiPropertyOptional({ example: 'ACORDADO EN REUNIÓN DEL 31/10' })
  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'La observación no puede exceder los 255 caracteres.' })
  observacion?: string;
}
