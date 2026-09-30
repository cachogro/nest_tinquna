import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsPositive, Max, Min } from 'class-validator';

/** Usado tanto para cerrar como para reabrir un período mensual. */
export class CerrarPeriodoCajaDto {
  @ApiProperty({ example: 1, description: 'Id de la caja.' })
  @Type(() => Number)
  @IsInt({ message: 'La caja no es válida.' })
  @IsPositive({ message: 'La caja no es válida.' })
  idCaja: number;

  @ApiProperty({ enum: ['BS', 'USD'], example: 'BS', description: 'Moneda del período.' })
  @IsIn(['BS', 'USD'], { message: 'La moneda debe ser BS o USD.' })
  moneda: 'BS' | 'USD';

  @ApiProperty({ example: 2025, description: 'Año / gestión.' })
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  gestion: number;

  @ApiProperty({ example: 7, description: 'Mes a cerrar / reabrir (1-12).' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  mes: number;
}
