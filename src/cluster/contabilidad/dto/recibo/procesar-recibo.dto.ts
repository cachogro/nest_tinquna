import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ReciboDetalleDto } from './recibo-detalle.dto';

/**
 * Cuerpo del `PATCH /contabilidad/recibo/:id/procesar`: solo aplica a un
 * recibo BORRADOR (creado sin `detalles`). Postea las líneas de kardex y
 * los movimientos de caja de flujo, y deja el recibo como PROCESADO.
 * Los campos de pago bancario son opcionales acá porque a veces recién en
 * este paso se sabe con exactitud el banco/cuenta usado; si no se envían,
 * se conserva lo que ya tenía el recibo desde que se creó como borrador.
 */
export class ProcesarReciboDto {
  @ApiProperty({
    type: [ReciboDetalleDto],
    description:
      'Cómo se subdivide el monto total del recibo entre kardex personal, kardex de actor productivo minero, y efectivo directo. La suma debe ser igual al `montoTotal` ya guardado en el recibo.',
    example: [
      { destino: 'PERSONAL', idPersona: '18', monto: 150000 },
      { destino: 'ACTOR', idActorProductivoMinero: '4', monto: 100000 },
      { destino: 'EFECTIVO', monto: 50000 },
    ],
  })
  @IsArray({ message: 'Los detalles deben ser una lista.' })
  @ArrayMinSize(1, { message: 'El recibo debe tener al menos una línea de detalle.' })
  @ValidateNested({ each: true })
  @Type(() => ReciboDetalleDto)
  detalles: ReciboDetalleDto[];

  @ApiPropertyOptional({
    example: 1,
    description: 'Id de la forma de pago. Si no se envía, se conserva la del borrador.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive({ message: 'La forma de pago no es válida.' })
  idFormaPago?: number;

  @ApiPropertyOptional({
    example: 1,
    description:
      'Id de la cuenta bancaria (parametrica.cuenta_bancaria), cuando el pago fue por un medio bancario. Si no se envía, se conserva la del borrador.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive({ message: 'La cuenta bancaria no es válida.' })
  idCuentaBancaria?: number;

  @ApiPropertyOptional({
    example: '4613159797',
    description:
      'N° de comprobante de la transacción bancaria. Si no se envía, se conserva el del borrador.',
  })
  @IsOptional()
  @IsString({ message: 'El N° de comprobante debe ser una cadena de texto.' })
  @MaxLength(30, { message: 'El N° de comprobante no puede exceder los 30 caracteres.' })
  nroComprobante?: string;

  @ApiPropertyOptional({
    example: 8,
    description:
      'Id del destino del gasto (parametrica.destino_gasto), aplicado tanto a las líneas de kardex como a los movimientos de caja de flujo que se generan. Si no se envía, se conserva el del borrador.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive({ message: 'El destino del gasto no es válido.' })
  idDestinoGasto?: number;
}
