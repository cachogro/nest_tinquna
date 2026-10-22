import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  Length,
} from 'class-validator';
import {
  CATEGORIAS_PLAN_CUENTAS,
  CategoriaPlanCuentas,
  NATURALEZAS_PLAN_CUENTAS,
  NaturalezaPlanCuentas,
  TIPOS_PLAN_CUENTAS,
  TipoPlanCuentas,
} from '../../entities/plan-cuentas.entity';

export class CreatePlanCuentasDto {
  @ApiPropertyOptional({
    example: 110204,
    description:
      'Id de la cuenta de resumen en la que sumariza. El código se genera solo (código del padre + siguiente correlativo) y el nivel es el del padre + 1. Sin padre se crea una clase nueva (nivel 1). No se puede cambiar al actualizar.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsPositive({ message: 'La cuenta padre no es válida.' })
  idPadre?: number;

  @ApiProperty({
    example: 'Juan Perez Mamani',
    description: 'Nombre de la cuenta. No puede repetirse bajo el mismo padre.',
  })
  @IsString({ message: 'El nombre debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'El nombre es obligatorio.' })
  @Length(3, 150, { message: 'El nombre debe tener entre 3 y 150 caracteres.' })
  nombre: string;

  @ApiPropertyOptional({
    enum: NATURALEZAS_PLAN_CUENTAS,
    description:
      'D = deudora, H = acreedora. Sin valor se hereda del padre (D si es una clase nueva).',
  })
  @IsOptional()
  @IsIn(NATURALEZAS_PLAN_CUENTAS, { message: 'La naturaleza debe ser D o H.' })
  naturaleza?: NaturalezaPlanCuentas;

  @ApiPropertyOptional({
    enum: TIPOS_PLAN_CUENTAS,
    description:
      'Solo decide en el nivel 4: R = se abre en subcuentas (por defecto), D = imputable sin subcuentas (p. ej. 110205 ANTICIPOS PROVEEDORES MINERAL SACOS, donde la persona la da el kardex). El nivel 5 siempre es D y los niveles 1-3 siempre R. Al actualizar, una cuenta de nivel 4 pasa a D solo si no tiene subcuentas, y a R solo si no tiene movimientos.',
  })
  @IsOptional()
  @IsIn(TIPOS_PLAN_CUENTAS, { message: 'El tipo debe ser R o D.' })
  tipo?: TipoPlanCuentas;

  @ApiPropertyOptional({
    enum: CATEGORIAS_PLAN_CUENTAS,
    description:
      'Solo cuentas de detalle (tipo D). Cómo cuenta en la ganancia estimada. Sin valor se toma de una cuenta hermana o, si no hay, OTRO_INGRESO en la clase 4 y GASTO_OPERATIVO en las demás.',
  })
  @IsOptional()
  @IsIn(CATEGORIAS_PLAN_CUENTAS, { message: 'La categoría no es válida.' })
  categoria?: CategoriaPlanCuentas;

  @ApiPropertyOptional({
    example: null,
    nullable: true,
    description:
      'Id de la cuenta de ajuste AITB (debe ser de detalle). null la quita.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsPositive({ message: 'La cuenta AITB no es válida.' })
  idCuentaAitb?: number | null;
}
