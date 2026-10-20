import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Body del `POST /contabilidad/personal-beneficio`: sin `id` asigna un
 * beneficio a la persona; con `id` lo actualiza.
 *
 * Lo que no se envía se copia del catálogo (al asignar) o no cambia (al
 * actualizar). Para cambiar el importe se manda `porcentaje` o `monto`
 * (el otro en null): uno de los dos.
 */
export class GuardarPersonalBeneficioDto {
  @ApiPropertyOptional({ example: '3', description: 'Solo para actualizar.' })
  @IsOptional()
  @IsString({ message: 'El id debe ser una cadena de texto.' })
  id?: string;

  @ApiProperty({ example: '18', description: 'Persona del personal interno.' })
  @IsNotEmpty({ message: 'Debe indicar la persona (idPersona).' })
  @IsString({ message: 'El id de la persona debe ser una cadena de texto.' })
  idPersona: string;

  @ApiProperty({ example: 1, description: 'Beneficio del catálogo (lactancia, natalidad...).' })
  @Type(() => Number)
  @IsInt({ message: 'El beneficio debe ser un id numérico.' })
  idBeneficioPlanilla: number;

  @ApiProperty({
    example: '2026-11-01',
    description: 'Primer mes que se paga (cualquier día del mes: se guarda el día 1).',
  })
  @IsDateString({}, { message: 'La fecha de inicio no es válida.' })
  fechaInicio: string;

  @ApiPropertyOptional({ example: 12, description: 'Meses que se paga. Si se omite, los del catálogo.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Los meses deben ser un número entero.' })
  @Min(1, { message: 'Debe pagarse al menos 1 mes.' })
  @Max(120, { message: 'No puede pagarse más de 120 meses.' })
  meses?: number;

  @ApiPropertyOptional({
    example: 100,
    description: 'Porcentaje sobre su salario mensual, propio de esta persona (o null para usar monto).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 }, { message: 'El porcentaje debe ser numérico (hasta 4 decimales).' })
  @Min(0.0001, { message: 'El porcentaje debe ser mayor a 0.' })
  @Max(1000, { message: 'El porcentaje no puede superar 1000.' })
  porcentaje?: number | null;

  @ApiPropertyOptional({ example: null, description: 'Monto fijo propio de esta persona (o null para usar porcentaje).' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El monto debe ser numérico con hasta 2 decimales.' })
  @Min(0.01, { message: 'El monto debe ser mayor a 0.' })
  monto?: number | null;

  @ApiPropertyOptional({ example: false, description: 'Entra en la base de AFP/CNS. Si se omite, el del catálogo.' })
  @IsOptional()
  @IsBoolean({ message: 'cotiza debe ser verdadero o falso.' })
  cotiza?: boolean;

  @ApiPropertyOptional({ example: 'HIJA NACIDA EL 28/10/2026' })
  @IsOptional()
  @IsString({ message: 'Las observaciones deben ser una cadena de texto.' })
  @MaxLength(255, { message: 'Las observaciones no pueden exceder los 255 caracteres.' })
  observaciones?: string | null;
}
