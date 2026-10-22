import { ApiProperty, ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsPositive } from 'class-validator';
import { CreatePlanCuentasDto } from './create-plan-cuentas.dto';

/** El padre (y con él código y nivel) no se cambia al actualizar. */
export class UpdatePlanCuentasDto extends OmitType(CreatePlanCuentasDto, [
  'idPadre',
] as const) {
  @ApiProperty({
    example: 1,
    description: 'Identificador de la cuenta del plan de cuentas.',
  })
  @Type(() => Number)
  @IsPositive({ message: 'El identificador no es válido.' })
  id: number;
}

/**
 * Body del POST único: sin `id` crea, con `id` actualiza (ahí `idPadre` se
 * ignora). Una clase concreta, no una unión, para que el ValidationPipe valide.
 */
export class GuardarPlanCuentasDto extends CreatePlanCuentasDto {
  @ApiPropertyOptional({
    example: 1,
    description: 'Con id se actualiza la cuenta.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsPositive({ message: 'El identificador no es válido.' })
  id?: number;
}
