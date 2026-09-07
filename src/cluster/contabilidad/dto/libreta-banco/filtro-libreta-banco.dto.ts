import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsPositive, Max, Min } from 'class-validator';

export class FiltroLibretaBancoDto {
  @ApiProperty({ example: 1, description: 'Id de la cuenta bancaria (obligatorio).' })
  @Type(() => Number)
  @IsInt({ message: 'La cuenta bancaria no es válida.' })
  @IsPositive({ message: 'La cuenta bancaria no es válida.' })
  idCuentaBancaria: number;

  @ApiPropertyOptional({ example: 2025, description: 'Año / gestión.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  gestion?: number;

  @ApiPropertyOptional({ example: 5, description: 'Mes (1-12). Requiere gestión.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  mes?: number;
}
