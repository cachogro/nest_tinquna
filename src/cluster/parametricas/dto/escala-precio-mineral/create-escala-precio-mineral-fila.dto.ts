import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, Min } from 'class-validator';

export class CreateEscalaPrecioMineralFilaDto {
  @IsNotEmpty({ message: 'La ley del tramo es obligatoria.' })
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 4 },
    { message: 'La ley debe ser un número válido.' },
  )
  @Min(0, { message: 'La ley no puede ser negativa.' })
  ley: number;

  @IsNotEmpty({ message: 'El precio por punto es obligatorio.' })
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 5 },
    { message: 'El precio por punto debe ser un número válido.' },
  )
  @Min(0, { message: 'El precio por punto no puede ser negativo.' })
  precioPunto: number;

  @IsNotEmpty({ message: 'El precio por tonelada métrica es obligatorio.' })
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 5 },
    { message: 'El precio por tonelada métrica debe ser un número válido.' },
  )
  @Min(0, { message: 'El precio por tonelada métrica no puede ser negativo.' })
  precioTm: number;
}
