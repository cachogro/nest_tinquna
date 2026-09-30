import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsPositive } from 'class-validator';
import { PaginacionQueryDto } from 'src/common/dto/paginacion-query.dto';

// `busqueda` (heredado): concepto, N° de comprobante o nombres de quien
// autorizó el traspaso.
export class FiltroTraspasoDto extends PaginacionQueryDto {
  @ApiPropertyOptional({ example: 1, description: 'Filtrar por caja de flujo.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  idCaja?: number;

  @ApiPropertyOptional({ example: 1, description: 'Filtrar por cuenta bancaria.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  idCuentaBancaria?: number;

  @ApiPropertyOptional({
    enum: ['DEPOSITO', 'RETIRO'],
    description: 'Filtrar por tipo de traspaso.',
  })
  @IsOptional()
  @IsIn(['DEPOSITO', 'RETIRO'])
  tipo?: 'DEPOSITO' | 'RETIRO';

  @ApiPropertyOptional({ example: 2026, description: 'Filtrar por gestión (año) de la fecha.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  gestion?: number;

  @ApiPropertyOptional({
    enum: ['fecha', 'id', 'monto'],
    description: 'Columna de ordenamiento (default: fecha).',
  })
  @IsOptional()
  @IsIn(['fecha', 'id', 'monto'])
  orderBy = 'fecha';
}
