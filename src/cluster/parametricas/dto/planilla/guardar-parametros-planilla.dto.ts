import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class ValorParametroPlanillaDto {
  @ApiProperty({ example: 'SALARIO_MINIMO_NACIONAL' })
  @IsNotEmpty({ message: 'Debe indicar el código del parámetro.' })
  @IsString({ message: 'El código del parámetro debe ser una cadena de texto.' })
  codigo: string;

  @ApiProperty({ example: 3300 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 }, { message: 'El valor debe ser numérico (hasta 4 decimales).' })
  @Min(0, { message: 'El valor no puede ser negativo.' })
  valor: number;
}

/** Body del `POST /parametricas/planilla/parametros`: solo cambia valores. */
export class GuardarParametrosPlanillaDto {
  @ApiProperty({ type: [ValorParametroPlanillaDto] })
  @IsArray({ message: 'Los parámetros deben ser una lista.' })
  @ArrayMinSize(1, { message: 'Envíe al menos un parámetro.' })
  @ValidateNested({ each: true })
  @Type(() => ValorParametroPlanillaDto)
  parametros: ValorParametroPlanillaDto[];
}
