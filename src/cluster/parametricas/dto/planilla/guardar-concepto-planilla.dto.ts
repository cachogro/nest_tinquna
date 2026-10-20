import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

/**
 * Body del `POST /parametricas/planilla/conceptos`: sin `id` registra un
 * concepto nuevo; con `id`, lo actualiza.
 */
export class GuardarConceptoPlanillaDto {
  @ApiPropertyOptional({ example: 3, description: 'Solo para actualizar.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive({ message: 'El identificador no es válido.' })
  id?: number;

  @ApiProperty({ example: 'GESTORA_VEJEZ', description: 'Código único (se guarda en mayúsculas).' })
  @IsString({ message: 'El código debe ser una cadena de texto.' })
  @Length(2, 40, { message: 'El código debe tener entre 2 y 40 caracteres.' })
  codigo: string;

  @ApiProperty({ example: 'Gestora - Aporte de vejez (jubilación)' })
  @IsString({ message: 'El nombre debe ser una cadena de texto.' })
  @Length(2, 120, { message: 'El nombre debe tener entre 2 y 120 caracteres.' })
  nombre: string;

  @ApiProperty({
    enum: ['DESCUENTO_LABORAL', 'APORTE_PATRONAL'],
    description: 'DESCUENTO_LABORAL se descuenta al trabajador; APORTE_PATRONAL lo paga la empresa.',
  })
  @IsIn(['DESCUENTO_LABORAL', 'APORTE_PATRONAL'], {
    message: 'El tipo debe ser DESCUENTO_LABORAL o APORTE_PATRONAL.',
  })
  tipo: 'DESCUENTO_LABORAL' | 'APORTE_PATRONAL';

  @ApiProperty({ example: 'GESTORA', description: 'A quién se le paga (GESTORA, CNS...). Se guarda en mayúsculas.' })
  @IsNotEmpty({ message: 'Debe indicar la entidad.' })
  @IsString({ message: 'La entidad debe ser una cadena de texto.' })
  @Length(2, 30, { message: 'La entidad debe tener entre 2 y 30 caracteres.' })
  entidad: string;

  @ApiProperty({ example: 10, description: 'Porcentaje sobre el total ganado (0 a 100).' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 }, { message: 'El porcentaje debe ser numérico (hasta 4 decimales).' })
  @Min(0, { message: 'El porcentaje no puede ser negativo.' })
  @Max(100, { message: 'El porcentaje no puede superar 100.' })
  porcentaje: number;

  @ApiPropertyOptional({
    example: 0,
    default: 0,
    description: '0 = sobre todo el total ganado; > 0 = solo sobre lo que excede este monto (Aporte Nacional Solidario).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El monto desde debe ser numérico con hasta 2 decimales.' })
  @Min(0, { message: 'El monto desde no puede ser negativo.' })
  montoDesde?: number;

  @ApiPropertyOptional({ example: 10, description: 'Orden en la boleta y la planilla.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El orden debe ser un número entero.' })
  orden?: number;
}
