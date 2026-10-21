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
  Matches,
  Min,
} from 'class-validator';

const TIPOS_SANCION = ['NINGUNA', 'DIAS', 'MONTO'] as const;

/**
 * Body del `POST /contabilidad/memorandum`. Lo omitido se completa: CITE y
 * número (siguiente de la gestión), lugar (ciudad del empleador), asunto
 * (según haya sanción), número de llamada (previas + 1) y cargo (de la
 * configuración de sueldo). El tratamiento (Sr., Lic....) de destinatario y
 * firmante sale de persona_ci; el cargo del firmante, de sus roles.
 */
export class CrearMemorandumDto {
  @ApiProperty({ example: '18', description: 'Destinatario (personal de la empresa).' })
  @IsNotEmpty({ message: 'Debe indicar la persona (idPersona).' })
  @IsString({ message: 'El id de la persona debe ser una cadena de texto.' })
  idPersona: string;

  @ApiPropertyOptional({ example: 'CAJERA', description: 'Por defecto, el cargo de su configuración de sueldo.' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  cargo?: string;

  @ApiProperty({
    example: '7',
    description: 'Quien firma: persona con el check autorizado (GET comercio_interno/persona_ci/autorizadas).',
  })
  @IsNotEmpty({ message: 'Debe indicar quién firma (idPersonaEmisor).' })
  @IsString()
  idPersonaEmisor: string;

  @ApiProperty({ example: '2026-10-20', description: 'Fecha del memorándum (YYYY-MM-DD).' })
  @IsDateString({}, { message: 'La fecha debe tener el formato YYYY-MM-DD.' })
  fecha: string;

  @ApiPropertyOptional({ example: 'Potosí' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  lugar?: string;

  @ApiPropertyOptional({ example: 'LLAMADA DE ATENCIÓN Y SANCIÓN' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  asunto?: string;

  @ApiPropertyOptional({
    example: 2,
    description:
      '1 = PRIMERA... Lo calcula el sistema: llamadas vigentes (no anuladas) de la persona con fecha hasta la del memorándum + 1. Si se envía debe coincidir; solo un memorándum en papel (con `numero`) puede traer otro, sin repetir uno vigente.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El número de llamada debe ser entero.' })
  @IsPositive({ message: 'El número de llamada debe ser mayor a cero.' })
  numeroLlamada?: number;

  @ApiProperty({ example: 'LLEGAR TARDE A OFICINA EN HORARIOS DE TRABAJO', description: 'Se guarda en mayúsculas.' })
  @IsNotEmpty({ message: 'Debe indicar el motivo.' })
  @IsString()
  @Matches(/\S/, { message: 'Debe indicar el motivo.' })
  @MaxLength(1000)
  motivo: string;

  @ApiPropertyOptional({ enum: TIPOS_SANCION, default: 'NINGUNA' })
  @IsOptional()
  @IsIn(TIPOS_SANCION, { message: 'El tipo de sanción debe ser NINGUNA, DIAS o MONTO.' })
  tipoSancion?: (typeof TIPOS_SANCION)[number];

  @ApiPropertyOptional({ example: 1, description: 'Obligatorio con tipoSancion DIAS (admite 0.5).' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 1 }, { message: 'Los días de sanción admiten un decimal.' })
  @IsPositive({ message: 'Los días de sanción deben ser mayores a cero.' })
  diasSancion?: number;

  @ApiPropertyOptional({
    example: 196.53,
    description: 'Obligatorio con MONTO. Con DIAS, por defecto salario mensual / 30 * días. Se descuenta en la siguiente boleta de sueldo.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El importe admite dos decimales.' })
  @Min(0)
  importeSancion?: number;

  @ApiPropertyOptional({
    example: 21,
    description: 'Solo para cargar memorándums ya emitidos en papel: N° dentro de la gestión de `fecha`.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  numero?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observaciones?: string;
}

export class AnularMemorandumDto {
  @ApiProperty({ example: 'SE EMITIÓ A OTRA PERSONA' })
  @IsNotEmpty({ message: 'Debe indicar el motivo de la anulación.' })
  @IsString({ message: 'Debe indicar el motivo de la anulación.' })
  @Matches(/\S/, { message: 'Debe indicar el motivo de la anulación.' })
  @MaxLength(255, { message: 'El motivo de la anulación no puede exceder los 255 caracteres.' })
  motivo: string;
}

export class FiltroMemorandumDto {
  @ApiPropertyOptional({ example: '18' })
  @IsOptional()
  @IsString()
  idPersona?: string;

  @ApiPropertyOptional({ example: 2026 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  gestion?: number;

  @ApiPropertyOptional({ enum: ['EMITIDO', 'ANULADO'] })
  @IsOptional()
  @IsIn(['EMITIDO', 'ANULADO'])
  estado?: 'EMITIDO' | 'ANULADO';

  @Type(() => Number)
  @IsOptional()
  page?: number;

  @Type(() => Number)
  @IsOptional()
  limit?: number;
}
