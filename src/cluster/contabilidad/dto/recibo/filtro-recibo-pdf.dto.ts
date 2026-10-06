import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';

export type FormatoReciboPdf = 'HORIZONTAL' | 'VERTICAL';

/** Opciones de `GET recibo/:id/pdf`. */
export class FiltroReciboPdfDto {
  @ApiPropertyOptional({
    enum: ['HORIZONTAL', 'VERTICAL'],
    default: 'HORIZONTAL',
    description:
      'Diseño del recibo. Por defecto HORIZONTAL, el que imprime el sistema.',
  })
  @IsOptional()
  @IsIn(['HORIZONTAL', 'VERTICAL'], {
    message: 'El formato debe ser HORIZONTAL o VERTICAL.',
  })
  formato?: FormatoReciboPdf;

  @ApiPropertyOptional({
    example: false,
    default: false,
    description:
      'true = desglosa "Por concepto" según los detalles del recibo (kardex, banco, efectivo).',
  })
  @IsOptional()
  // La conversión implícita vuelve true cualquier texto no vacío ("false" incluido).
  @Transform(
    ({ obj }: { obj: Record<string, unknown> }) =>
      obj.procesado === true || obj.procesado === 'true',
  )
  @IsBoolean({ message: 'procesado debe ser true o false.' })
  procesado?: boolean;
}
