import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsPositive } from 'class-validator';
import { CreatePlanCuentasDto } from './create-plan-cuentas.dto';

export class UpdatePlanCuentasDto extends CreatePlanCuentasDto {
  @ApiProperty({ example: 1, description: 'Identificador de la cuenta del plan de cuentas.' })
  @Type(() => Number)
  @IsPositive({ message: 'El identificador no es válido.' })
  id: number;
}
