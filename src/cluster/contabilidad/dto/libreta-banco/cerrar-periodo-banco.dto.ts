import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsPositive, Max, Min } from 'class-validator';

/** Usado tanto para cerrar como para reabrir un período mensual. */
export class CerrarPeriodoBancoDto {
  @ApiProperty({ example: 1, description: 'Id de la cuenta bancaria.' })
  @Type(() => Number)
  @IsInt({ message: 'La cuenta bancaria no es válida.' })
  @IsPositive({ message: 'La cuenta bancaria no es válida.' })
  idCuentaBancaria: number;

  @ApiProperty({ example: 2025, description: 'Año / gestión.' })
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  gestion: number;

  @ApiProperty({ example: 5, description: 'Mes a cerrar / reabrir (1-12).' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  mes: number;
}
