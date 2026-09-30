import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsPositive } from 'class-validator';

export class FiltroReporteDestinoGastoDto {
  @ApiProperty({
    enum: ['BS', 'USD'],
    example: 'BS',
    description:
      'Moneda del reporte (obligatorio: no se mezclan monedas en un mismo total).',
  })
  @IsIn(['BS', 'USD'], { message: 'La moneda debe ser BS o USD.' })
  moneda: 'BS' | 'USD';

  @ApiPropertyOptional({
    example: 1,
    description:
      'Id de la caja de flujo. Si se omite, se consideran todas las cajas (no afecta la parte de bancos).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La caja no es válida.' })
  @IsPositive({ message: 'La caja no es válida.' })
  idCaja?: number;

  @ApiPropertyOptional({
    example: 1,
    description:
      'Id de la cuenta bancaria. Si se omite, se consideran todas las cuentas de la moneda pedida (no afecta la parte de caja).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La cuenta bancaria no es válida.' })
  @IsPositive({ message: 'La cuenta bancaria no es válida.' })
  idCuentaBancaria?: number;

  @ApiPropertyOptional({
    example: '2026-01-01',
    description: 'Fecha inicial (YYYY-MM-DD), inclusive.',
  })
  @IsOptional()
  @IsDateString({}, { message: 'fechaDesde debe tener el formato YYYY-MM-DD.' })
  fechaDesde?: string;

  @ApiPropertyOptional({
    example: '2026-12-31',
    description: 'Fecha final (YYYY-MM-DD), inclusive.',
  })
  @IsOptional()
  @IsDateString({}, { message: 'fechaHasta debe tener el formato YYYY-MM-DD.' })
  fechaHasta?: string;
}
