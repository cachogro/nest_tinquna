import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

const HORA = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
const hora = (campo: string) =>
  Matches(HORA, { message: `${campo} debe tener el formato HH:MM (24 horas).` });
// '' o null = sin marcar.
const siHay = ValidateIf((_, v) => v !== null && v !== undefined && v !== '');

export class RegistroAsistenciaDto {
  @ApiProperty({ example: '2026-10-14' })
  @IsDateString({}, { message: 'La fecha debe tener el formato YYYY-MM-DD.' })
  fecha: string;

  @ApiPropertyOptional({ example: '08:42' })
  @IsOptional()
  @siHay
  @hora('La hora de ingreso')
  horaIngreso?: string | null;

  @ApiPropertyOptional({ example: '12:30' })
  @IsOptional()
  @siHay
  @hora('La salida a almuerzo')
  horaSalidaAlmuerzo?: string | null;

  @ApiPropertyOptional({ example: '14:35' })
  @IsOptional()
  @siHay
  @hora('El retorno de almuerzo')
  horaRetornoAlmuerzo?: string | null;

  @ApiPropertyOptional({ example: '18:30' })
  @IsOptional()
  @siHay
  @hora('La hora de salida')
  horaSalida?: string | null;

  @ApiPropertyOptional({ example: false, description: 'Faltó todo el día.' })
  @IsOptional()
  @IsBoolean()
  falta?: boolean;

  @ApiPropertyOptional({ example: false, description: 'Con justificativo: ese día no se descuenta.' })
  @IsOptional()
  @IsBoolean()
  justificado?: boolean;

  @ApiPropertyOptional({ example: 'CERTIFICADO MÉDICO' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  justificacion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  observaciones?: string;
}

/**
 * Body del `POST /contabilidad/asistencia/lote`: crea o actualiza los días
 * indicados (uno por fecha). Un día sin marcas, sin falta y sin
 * justificación se borra.
 */
export class GuardarAsistenciaLoteDto {
  @ApiProperty({ example: '3' })
  @IsNotEmpty({ message: 'Debe indicar la persona (idPersona).' })
  @IsString()
  idPersona: string;

  @ApiProperty({ type: [RegistroAsistenciaDto] })
  @IsArray({ message: 'Los registros deben ser una lista.' })
  @ValidateNested({ each: true })
  @Type(() => RegistroAsistenciaDto)
  registros: RegistroAsistenciaDto[];
}

export class FiltroAsistenciaDto {
  @ApiProperty({ example: '2026-10-01' })
  @IsDateString({}, { message: 'La fecha desde debe tener el formato YYYY-MM-DD.' })
  desde: string;

  @ApiProperty({ example: '2026-10-31' })
  @IsDateString({}, { message: 'La fecha hasta debe tener el formato YYYY-MM-DD.' })
  hasta: string;
}
