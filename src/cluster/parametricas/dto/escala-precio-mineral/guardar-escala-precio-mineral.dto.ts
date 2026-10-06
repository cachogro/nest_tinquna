import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

/**
 * Fila del cuerpo único del `POST /parametricas/escala-precio`:
 * sin `id` es un tramo nuevo ("ley", "precioPunto" y "precioTm" obligatorios),
 * con `id` es un tramo a actualizar (solo se modifica lo que se envía).
 */
export class GuardarEscalaPrecioMineralFilaDto {
  @IsOptional()
  @Type(() => Number)
  @IsPositive({ message: 'El id del tramo no es válido.' })
  id?: number;

  @ValidateIf((fila) => fila.id == null || fila.ley != null)
  @IsNotEmpty({ message: 'La ley del tramo es obligatoria.' })
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 4 },
    { message: 'La ley debe ser un número válido.' },
  )
  @Min(0, { message: 'La ley no puede ser negativa.' })
  ley?: number;

  @ValidateIf((fila) => fila.id == null || fila.precioPunto != null)
  @IsNotEmpty({ message: 'El precio por punto es obligatorio.' })
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 5 },
    { message: 'El precio por punto debe ser un número válido.' },
  )
  @Min(0, { message: 'El precio por punto no puede ser negativo.' })
  precioPunto?: number;

  @ValidateIf((fila) => fila.id == null || fila.precioTm != null)
  @IsNotEmpty({ message: 'El precio por tonelada métrica es obligatorio.' })
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 5 },
    { message: 'El precio por tonelada métrica debe ser un número válido.' },
  )
  @Min(0, { message: 'El precio por tonelada métrica no puede ser negativo.' })
  precioTm?: number;

  @IsOptional()
  @IsDateString({}, { message: 'La fecha de vigencia inicial no tiene un formato válido.' })
  fechaVigenciaInicial?: string;

  @IsOptional()
  @IsDateString({}, { message: 'La fecha de vigencia final no tiene un formato válido.' })
  fechaVigenciaFinal?: string;
}

const esActualizacion = (body: GuardarEscalaPrecioMineralDto): boolean =>
  Array.isArray(body.filas) && body.filas.some((fila) => fila?.id != null);

/**
 * Se usa como cuerpo único del `POST /parametricas/escala-precio`:
 * filas sin `id` registran la tabla (requiere "idMineral" y
 * "fechaVigenciaInicial"), filas con `id` actualizan tramos existentes.
 * Al ser un solo tipo (no una unión) el ValidationPipe global sí lo valida.
 */
export class GuardarEscalaPrecioMineralDto {
  @ValidateIf((body) => !esActualizacion(body))
  @IsNotEmpty({ message: 'El mineral es obligatorio.' })
  @Type(() => Number)
  @IsPositive({ message: 'El mineral seleccionado no es válido.' })
  idMineral?: number;

  @ValidateIf((body) => !esActualizacion(body))
  @IsNotEmpty({ message: 'La fecha de vigencia inicial es obligatoria.' })
  @IsDateString({}, { message: 'La fecha de vigencia inicial no tiene un formato válido.' })
  fechaVigenciaInicial?: string;

  @IsOptional()
  @IsDateString({}, { message: 'La fecha de vigencia final no tiene un formato válido.' })
  fechaVigenciaFinal?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Debe enviar al menos un tramo de ley.' })
  @ArrayUnique(
    (fila: GuardarEscalaPrecioMineralFilaDto) =>
      fila.id != null ? `id:${fila.id}` : fila.ley,
    { message: 'No puede repetir la misma ley dentro de la misma carga.' },
  )
  @ValidateNested({ each: true })
  @Type(() => GuardarEscalaPrecioMineralFilaDto)
  filas: GuardarEscalaPrecioMineralFilaDto[];
}
