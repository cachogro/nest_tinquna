import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Body del `POST /parametricas/planilla/beneficios`: sin `id` registra un
 * beneficio nuevo; con `id`, lo actualiza. Va `porcentaje` o `monto`, uno
 * de los dos (lo valida el servicio).
 */
export class GuardarBeneficioPlanillaDto {
  @ApiPropertyOptional({ example: 1, description: 'Solo para actualizar.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive({ message: 'El identificador no es válido.' })
  id?: number;

  @ApiProperty({ example: 'SUBSIDIO DE LACTANCIA', description: 'Único; se guarda en mayúsculas.' })
  @IsString({ message: 'El nombre debe ser una cadena de texto.' })
  @Length(3, 80, { message: 'El nombre debe tener entre 3 y 80 caracteres.' })
  nombre: string;

  @ApiPropertyOptional({
    example: 100,
    description: 'Porcentaje sobre el salario mensual de la persona. Si se omite (o null), se usa `monto`.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 }, { message: 'El porcentaje debe ser numérico (hasta 4 decimales).' })
  @Min(0.0001, { message: 'El porcentaje debe ser mayor a 0.' })
  @Max(1000, { message: 'El porcentaje no puede superar 1000.' })
  porcentaje?: number | null;

  @ApiPropertyOptional({ example: 500, description: 'Importe fijo mensual en Bs, cuando no hay porcentaje.' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El monto debe ser numérico con hasta 2 decimales.' })
  @Min(0.01, { message: 'El monto debe ser mayor a 0.' })
  monto?: number | null;

  @ApiProperty({ example: 12, description: 'Cuántos meses seguidos se paga (1 a 120).' })
  @Type(() => Number)
  @IsInt({ message: 'Los meses deben ser un número entero.' })
  @Min(1, { message: 'Debe pagarse al menos 1 mes.' })
  @Max(120, { message: 'No puede pagarse más de 120 meses.' })
  meses: number;

  @ApiPropertyOptional({
    example: false,
    default: false,
    description: 'true = el bono entra en la base de los descuentos y aportes (AFP, CNS).',
  })
  @IsOptional()
  @IsBoolean({ message: 'cotiza debe ser verdadero o falso.' })
  cotiza?: boolean;

  @ApiPropertyOptional({ example: 'UN SALARIO MÍNIMO POR MES DURANTE EL PRIMER AÑO DEL HIJO' })
  @IsOptional()
  @IsString({ message: 'La descripción debe ser una cadena de texto.' })
  @MaxLength(255, { message: 'La descripción no puede exceder los 255 caracteres.' })
  descripcion?: string | null;
}
