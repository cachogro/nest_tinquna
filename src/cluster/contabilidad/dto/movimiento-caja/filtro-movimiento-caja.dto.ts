import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsPositive, Max, Min } from 'class-validator';

export class FiltroMovimientoCajaDto {
  @ApiProperty({ example: 1, description: 'Id de la caja (obligatorio).' })
  @Type(() => Number)
  @IsInt({ message: 'La caja no es válida.' })
  @IsPositive({ message: 'La caja no es válida.' })
  idCaja: number;

  @ApiProperty({
    enum: ['BOB', 'USD'],
    example: 'BOB',
    description: 'Moneda a listar (obligatorio: el saldo corriente se calcula por moneda).',
  })
  @IsIn(['BOB', 'USD'], { message: 'La moneda debe ser BOB o USD.' })
  moneda: 'BOB' | 'USD';

  @ApiPropertyOptional({ example: 2025, description: 'Año / gestión.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  gestion?: number;

  @ApiPropertyOptional({ example: 7, description: 'Mes (1-12). Requiere gestión.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  mes?: number;
}
