import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * Cuerpo del `POST /contabilidad/fondo-rendir/detalle`: sin `id` agrega una
 * línea de justificación (comprobante de gasto); con `id` la actualiza. No
 * mueve plata de caja/banco. La suma de las líneas activas no puede superar
 * `montoEntregado` del fondo.
 */
export class CreateFondoRendirDetalleDto {
  @ApiPropertyOptional({
    description: 'Id de la línea. Presente => actualizar; ausente => agregar.',
    example: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive({ message: 'El id de la línea no es válido.' })
  id?: number;

  @ApiProperty({
    example: 4,
    description: 'Id del fondo a rendir que se está justificando.',
  })
  @Type(() => Number)
  @IsInt({ message: 'El fondo a rendir no es válido.' })
  @IsPositive({ message: 'El fondo a rendir no es válido.' })
  idFondoRendir: number;

  @ApiProperty({ example: '2026-09-25', description: 'Fecha del gasto (YYYY-MM-DD).' })
  @IsDateString({}, { message: 'La fecha debe tener el formato YYYY-MM-DD.' })
  fecha: string;

  @ApiProperty({
    example: 'COMPRA DE CEMENTO - 5 BOLSAS',
    description: 'Detalle del gasto justificado.',
  })
  @IsString({ message: 'El concepto debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'El concepto es obligatorio.' })
  @MaxLength(255, { message: 'El concepto no puede exceder los 255 caracteres.' })
  concepto: string;

  @ApiProperty({ example: 90, description: 'Monto justificado en esta línea (mayor a 0).' })
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El monto debe ser numérico con hasta 2 decimales.' },
  )
  @IsPositive({ message: 'El monto debe ser mayor a 0.' })
  monto: number;

  @ApiPropertyOptional({
    example: 'FAC-0456',
    description: 'N° de comprobante (factura, nota de venta) que respalda el gasto.',
  })
  @IsOptional()
  @IsString({ message: 'El N° de comprobante debe ser una cadena de texto.' })
  @MaxLength(30, { message: 'El N° de comprobante no puede exceder los 30 caracteres.' })
  nroComprobante?: string;

  @ApiPropertyOptional({
    example: 'FAC:0456',
    description: 'Documento adicional que respalda la línea, si aplica.',
  })
  @IsOptional()
  @IsString({ message: 'El campo factura/recibo debe ser una cadena de texto.' })
  @MaxLength(30, { message: 'El campo factura/recibo no puede exceder los 30 caracteres.' })
  facturaRecibo?: string;

  @ApiPropertyOptional({
    example: 13,
    description: 'Id del destino del gasto de esta línea puntual, si difiere del de la cabecera.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive({ message: 'El destino del gasto no es válido.' })
  idDestinoGasto?: number;
}
