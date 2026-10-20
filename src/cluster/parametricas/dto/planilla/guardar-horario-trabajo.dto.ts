import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const HORA = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
const MENSAJE_HORA = 'debe tener el formato HH:MM (24 horas).';

export class HorarioTrabajoDiaDto {
  @ApiProperty({ example: 1, description: '1 = lunes ... 7 = domingo.' })
  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'El día de la semana va de 1 (lunes) a 7 (domingo).' })
  @Max(7, { message: 'El día de la semana va de 1 (lunes) a 7 (domingo).' })
  diaSemana: number;

  @ApiProperty({ example: '08:30' })
  @Matches(HORA, { message: `La hora de ingreso ${MENSAJE_HORA}` })
  horaIngreso: string;

  @ApiPropertyOptional({ example: '12:30', description: 'Vacío (junto con el retorno) = horario continuo.' })
  @IsOptional()
  @Matches(HORA, { message: `La hora de salida a almuerzo ${MENSAJE_HORA}` })
  horaSalidaAlmuerzo?: string | null;

  @ApiPropertyOptional({ example: '14:30' })
  @IsOptional()
  @Matches(HORA, { message: `La hora de retorno de almuerzo ${MENSAJE_HORA}` })
  horaRetornoAlmuerzo?: string | null;

  @ApiProperty({ example: '18:30' })
  @Matches(HORA, { message: `La hora de salida ${MENSAJE_HORA}` })
  horaSalida: string;
}

/**
 * Body del `POST /parametricas/horario-trabajo`: sin `id` registra; con `id`
 * actualiza. `dias` reemplaza todos los días del horario (los que no
 * figuran son no laborables). Para un horario de temporada (invierno),
 * `idHorarioReemplaza` + `vigenciaDesde` / `vigenciaHasta`.
 */
export class GuardarHorarioTrabajoDto {
  @ApiPropertyOptional({ example: 1, description: 'Solo para actualizar.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive({ message: 'El identificador no es válido.' })
  id?: number;

  @ApiProperty({ example: 'OFICINA DISCONTINUO' })
  @IsString({ message: 'La descripción debe ser una cadena de texto.' })
  @Length(2, 80, { message: 'La descripción debe tener entre 2 y 80 caracteres.' })
  descripcion: string;

  @ApiPropertyOptional({ example: 1, description: 'Horario al que reemplaza en la temporada (invierno). null = horario base.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive({ message: 'El horario que reemplaza no es válido.' })
  idHorarioReemplaza?: number | null;

  @ApiPropertyOptional({ example: '2026-06-01' })
  @IsOptional()
  @IsDateString({}, { message: 'La vigencia desde debe tener el formato YYYY-MM-DD.' })
  vigenciaDesde?: string | null;

  @ApiPropertyOptional({ example: '2026-08-31' })
  @IsOptional()
  @IsDateString({}, { message: 'La vigencia hasta debe tener el formato YYYY-MM-DD.' })
  vigenciaHasta?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  observaciones?: string;

  @ApiProperty({ type: [HorarioTrabajoDiaDto] })
  @IsArray({ message: 'Los días deben ser una lista.' })
  @ValidateNested({ each: true })
  @Type(() => HorarioTrabajoDiaDto)
  dias: HorarioTrabajoDiaDto[];
}
