import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, Max, Min } from 'class-validator';

export enum TipoBaseAporte {
  VBV = 'VBV',
  VNV = 'VNV',
}

export class DetalleAporteDto {
  @ApiProperty({
    example: 0.35,
    description: 'Alícuota aplicada para el cálculo del aporte.',
  })
  @IsNumber(
    {},
    {
      message: 'La alícuota debe ser un número.',
    },
  )
  @Min(0, {
    message: 'La alícuota no puede ser negativa.',
  })
  @Max(100, {
    message: 'La alícuota no puede superar 100.',
  })
  alicuota: number;

  @ApiProperty({
    enum: TipoBaseAporte,
    example: TipoBaseAporte.VBV,
    description:
      'Tipo de base sobre la que se calcula el aporte: VBV (Valor Bruto de Venta) o VNV (Valor Neto de Venta).',
  })
  @IsEnum(TipoBaseAporte, {
    message: 'El tipo de base de aporte debe ser VBV o VNV.',
  })
  tipoBaseAporte: TipoBaseAporte;
}
