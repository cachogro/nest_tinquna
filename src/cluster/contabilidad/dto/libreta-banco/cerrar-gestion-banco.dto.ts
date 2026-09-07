import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsPositive, Max, Min } from 'class-validator';

/** Usado tanto para cerrar como para reabrir la gestión de una cuenta. */
export class CerrarGestionBancoDto {
  @ApiProperty({ example: 1, description: 'Id de la cuenta bancaria.' })
  @Type(() => Number)
  @IsInt({ message: 'La cuenta bancaria no es válida.' })
  @IsPositive({ message: 'La cuenta bancaria no es válida.' })
  idCuentaBancaria: number;

  @ApiProperty({ example: 2025, description: 'Año / gestión a cerrar / reabrir.' })
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  gestion: number;
}
