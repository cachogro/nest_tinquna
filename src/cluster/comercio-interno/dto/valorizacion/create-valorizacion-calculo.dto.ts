import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsObject, IsOptional } from 'class-validator';

export class CreateValorizacionCalculoDto {
  @ApiProperty({
    description:
      'Id del tipo de cálculo (parametrica.tipo_calculo_valorizacion): maquila, ajuste de maquila, penalidad por elemento, etc. Depende de la codificación de la recepción.',
    example: 1,
  })
  @IsInt()
  idTipoCalculoValorizacion: number;

  @ApiPropertyOptional({
    description:
      'Base sobre la que se calculó (ej. TMS, exceso de ley sobre el límite libre). No todas las codificaciones la usan.',
    example: 12.5,
  })
  @IsOptional()
  @IsNumber()
  baseCalculo?: number;

  @ApiPropertyOptional({
    description:
      'Valor/tasa aplicado (ej. cargo USD/TMS, escalador). No todas las codificaciones la usan.',
    example: 85,
  })
  @IsOptional()
  @IsNumber()
  valorAplicado?: number;

  @ApiProperty({
    description:
      'Importe final en bolivianos, ya calculado por el front. Puede ser negativo (ajustes a favor del proveedor).',
    example: 454.12,
  })
  @IsNumber()
  importeBolivianos: number;

  @ApiPropertyOptional({
    description:
      'Detalle adicional del cálculo (ej. ley aplicada, ley libre, cargo usado), útil para trazabilidad y reimpresión.',
    example: { ley: 0.55, leyLibre: 0.4, cargo: 2.5 },
  })
  @IsOptional()
  @IsObject()
  extras?: Record<string, any>;
}
