import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';
import {
  CATEGORIAS_PLAN_CUENTAS,
  CategoriaPlanCuentas,
} from '../../entities/plan-cuentas.entity';

export class CreatePlanCuentasDto {
  @ApiProperty({
    example: 'COMBUSTIBLE GASOLINA',
    description: 'Nombre de la cuenta del plan de cuentas.',
  })
  @IsString({ message: 'El nombre debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'El nombre es obligatorio.' })
  @Length(3, 80, { message: 'El nombre debe tener entre 3 y 80 caracteres.' })
  nombre: string;

  @ApiProperty({
    example: true,
    description: 'TRUE = egreso (sale dinero), FALSE = ingreso (entra dinero).',
  })
  @IsBoolean({ message: 'esEgreso debe ser verdadero o falso.' })
  esEgreso: boolean;

  @ApiPropertyOptional({
    enum: CATEGORIAS_PLAN_CUENTAS,
    description:
      'Cómo cuenta en la ganancia estimada. Sin valor: GASTO_OPERATIVO si es egreso, OTRO_INGRESO si es ingreso.',
  })
  @IsOptional()
  @IsIn(CATEGORIAS_PLAN_CUENTAS, { message: 'La categoría no es válida.' })
  categoria?: CategoriaPlanCuentas;
}
