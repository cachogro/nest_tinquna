import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateValorizacionMineralDetalleDto {
  @ApiProperty({
    description: 'Id del mineral (debe pertenecer a la codificación de la recepción).',
    example: 6,
  })
  @IsInt()
  idMineral: number;

  @ApiProperty({
    description: 'Ley del mineral según informe de laboratorio.',
    example: 45.5,
  })
  @IsNumber()
  ley: number;

  @ApiPropertyOptional({
    description: 'Unidad de la ley (%, oz/tn, etc).',
    example: '%',
  })
  @IsOptional()
  @IsString()
  @MaxLength(4)
  leyUnidad?: string;

  @ApiPropertyOptional({
    description: 'Ley pagable del mineral (después de aplicar descuentos/penalidades).',
    example: 44.8,
  })
  @IsOptional()
  @IsNumber()
  leyPagable?: number;

  @ApiPropertyOptional({
    description: 'Id de la cotización de mineral (parametrica.cotizacion_mineral) aplicada.',
    example: 12,
  })
  @IsOptional()
  @IsInt()
  idCotizacionMineral?: number;

  @ApiPropertyOptional({
    description: 'Porcentaje de la cotización aplicado sobre la cotización base.',
    example: 95.0,
  })
  @IsOptional()
  @IsNumber()
  porcentajeCotizacion?: number;

  @ApiPropertyOptional({
    description: 'Cotización finalmente aplicada al mineral (ya con el porcentaje aplicado).',
    example: 25.4321,
  })
  @IsOptional()
  @IsNumber()
  cotizacionAplicada?: number;

  @ApiPropertyOptional({
    description: 'Precio por kilo resultante para este detalle de mineral.',
    example: 113.7654,
  })
  @IsOptional()
  @IsNumber()
  precioKilo?: number;

  @ApiPropertyOptional({
    description: 'Precio (entero) para este detalle de mineral.',
    example: 114,
  })
  @IsOptional()
  @IsInt()
  precio?: number;

  // ============================
  // Pricing por escala (RAM cargas)
  // ============================

  @ApiPropertyOptional({
    description:
      'Id del tramo de escala de precio (parametrica.escala_precio_mineral) aplicado.',
    example: 56,
  })
  @IsOptional()
  @IsInt()
  idEscalaPrecio?: number;

  @ApiPropertyOptional({
    description: 'Ajuste de puntos sobre la ley (puede ser negativo).',
    example: 0,
  })
  @IsOptional()
  @IsNumber()
  ajustePuntosLey?: number;

  @ApiPropertyOptional({
    description: 'Ley ajustada resultante de aplicar el ajuste de puntos.',
    example: 18,
  })
  @IsOptional()
  @IsNumber()
  leyAjustada?: number;

  @ApiPropertyOptional({
    description: 'Precio USD/TM resultante para este detalle de mineral.',
    example: 208.8,
  })
  @IsOptional()
  @IsNumber()
  precioUsdTm?: number;
}
