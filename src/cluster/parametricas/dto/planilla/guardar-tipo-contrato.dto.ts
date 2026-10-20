import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Length,
} from 'class-validator';

/** Checks de lo que le corresponde a un contrato o a una persona. */
export class ChecksPlanillaDto {
  @ApiPropertyOptional({ example: true, default: false })
  @IsOptional()
  @IsBoolean({ message: 'aplicaBonoAntiguedad debe ser verdadero o falso.' })
  aplicaBonoAntiguedad?: boolean;

  @ApiPropertyOptional({ example: true, default: false })
  @IsOptional()
  @IsBoolean({ message: 'aplicaHorasExtra debe ser verdadero o falso.' })
  aplicaHorasExtra?: boolean;

  @ApiPropertyOptional({ example: true, default: false })
  @IsOptional()
  @IsBoolean({ message: 'aplicaAguinaldo debe ser verdadero o falso.' })
  aplicaAguinaldo?: boolean;

  @ApiPropertyOptional({ example: true, default: false })
  @IsOptional()
  @IsBoolean({ message: 'aplicaVacaciones debe ser verdadero o falso.' })
  aplicaVacaciones?: boolean;

  @ApiPropertyOptional({ example: true, default: false })
  @IsOptional()
  @IsBoolean({ message: 'aplicaIndemnizacion debe ser verdadero o falso.' })
  aplicaIndemnizacion?: boolean;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean({ message: 'aplicaDesahucio debe ser verdadero o falso.' })
  aplicaDesahucio?: boolean;
}

/**
 * Body del `POST /parametricas/tipo-contrato`: sin `id` registra; con `id`
 * actualiza. `idsConceptos` = descuentos/aportes que le corresponden por
 * defecto (reemplaza la lista completa).
 */
export class GuardarTipoContratoDto extends ChecksPlanillaDto {
  @ApiPropertyOptional({ example: 1, description: 'Solo para actualizar.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive({ message: 'El identificador no es válido.' })
  id?: number;

  @ApiProperty({ example: 'PLAZO INDEFINIDO', description: 'Se guarda en mayúsculas y no se repite.' })
  @IsString({ message: 'La descripción debe ser una cadena de texto.' })
  @Length(2, 80, { message: 'La descripción debe tener entre 2 y 80 caracteres.' })
  descripcion: string;

  @ApiPropertyOptional({ example: [1, 2, 3, 4, 8], type: [Number] })
  @IsOptional()
  @IsArray({ message: 'Los conceptos deben ser una lista de ids.' })
  @Type(() => Number)
  @IsInt({ each: true, message: 'Cada concepto debe ser un id numérico.' })
  idsConceptos?: number[];
}
