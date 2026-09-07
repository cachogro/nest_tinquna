import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsPositive, Max, Min } from 'class-validator';

/** Usado tanto para cerrar como para reabrir la gestión de una caja. */
export class CerrarGestionCajaDto {
  @ApiProperty({ example: 1, description: 'Id de la caja.' })
  @Type(() => Number)
  @IsInt({ message: 'La caja no es válida.' })
  @IsPositive({ message: 'La caja no es válida.' })
  idCaja: number;

  @ApiProperty({ enum: ['BOB', 'USD'], example: 'BOB', description: 'Moneda de la gestión.' })
  @IsIn(['BOB', 'USD'], { message: 'La moneda debe ser BOB o USD.' })
  moneda: 'BOB' | 'USD';

  @ApiProperty({ example: 2025, description: 'Año / gestión a cerrar / reabrir.' })
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  gestion: number;
}
