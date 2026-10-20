import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  Min,
  ValidateNested,
} from 'class-validator';

export class TramoEscalaPlanillaDto {
  @ApiProperty({ example: 2, description: 'Años cumplidos desde (inclusive).' })
  @Type(() => Number)
  @IsInt({ message: 'Los años desde deben ser un número entero.' })
  @Min(0, { message: 'Los años desde no pueden ser negativos.' })
  aniosDesde: number;

  @ApiPropertyOptional({ example: 4, description: 'Años cumplidos hasta (inclusive). null = en adelante.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Los años hasta deben ser un número entero.' })
  @Min(0, { message: 'Los años hasta no pueden ser negativos.' })
  aniosHasta?: number | null;

  @ApiProperty({ example: 5, description: 'BONO_ANTIGUEDAD: %. VACACION: días hábiles.' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El valor debe ser numérico con hasta 2 decimales.' })
  @Min(0, { message: 'El valor no puede ser negativo.' })
  valor: number;
}

/**
 * Body del `POST /parametricas/planilla/escalas`: reemplaza la tabla
 * completa del tipo indicado (igual que la escala de precios del mineral).
 */
export class GuardarEscalaPlanillaDto {
  @ApiProperty({
    enum: ['BONO_ANTIGUEDAD', 'VACACION', 'ATRASO'],
    description: 'ATRASO: desde/hasta son minutos de atraso acumulados en el mes y valor = días de haber a descontar.',
  })
  @IsIn(['BONO_ANTIGUEDAD', 'VACACION', 'ATRASO'], { message: 'El tipo debe ser BONO_ANTIGUEDAD, VACACION o ATRASO.' })
  tipo: 'BONO_ANTIGUEDAD' | 'VACACION' | 'ATRASO';

  @ApiProperty({ type: [TramoEscalaPlanillaDto], description: 'Puede ir vacía para dejar la tabla sin tramos.' })
  @IsArray({ message: 'Los tramos deben ser una lista.' })
  @ValidateNested({ each: true })
  @Type(() => TramoEscalaPlanillaDto)
  tramos: TramoEscalaPlanillaDto[];
}
