import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { CreateRecepcionMineralDetalleDto } from './create-recepcion-mineral-detalle.dto';

export class CreateRecepcionMineralDto {
  @ApiProperty({
    description: 'Identificador de la codificación.',
    example: '1',
  })
  @IsString()
  @IsNotEmpty({
    message: 'La codificación es obligatoria.',
  })
  idCodificacion: string;

  @ApiProperty({
    description: 'Identificador del proveedor.',
    example: '15',
  })
  @IsString()
  @IsNotEmpty({
    message: 'El proveedor es obligatorio.',
  })
  idPersona: string;

  @ApiProperty({
    description: 'Cantidad de sacos recibidos.',
    example: 120,
  })
  @IsNumber()
  @IsPositive({
    message: 'El número de sacos debe ser mayor a cero.',
  })
  numeroSacos: number;

  @ApiProperty({
    description: 'Peso neto del mineral en kilogramos.',
    example: 2450.35897,
  })
  @IsNumber(
    {},
    {
      message: 'El peso neto debe ser un número válido.',
    },
  )
  @IsPositive({
    message: 'El peso neto debe ser mayor a cero.',
  })
  pesoNeto: number;

  @ApiPropertyOptional({
    description: 'Monto del anticipo entregado al proveedor.',
    example: 15000.5,
  })
  @IsOptional()
  @IsNumber(
    {},
    {
      message: 'El anticipo debe ser un número válido.',
    },
  )
  anticipo?: number;

  // @ApiPropertyOptional({
  //   description: 'Ley referencial del mineral.',
  //   example: 58.75,
  // })
  // @IsOptional()
  // @IsNumber(
  //   {},
  //   {
  //     message: 'La ley debe ser un número válido.',
  //   },
  // )
  // ley?: number;

  // @ApiPropertyOptional({
  //   description: 'Valor bruto referencial de la compra.',
  //   example: 98500.75,
  // })
  // @IsOptional()
  // @IsNumber(
  //   {},
  //   {
  //     message: 'El valor bruto debe ser un número válido.',
  //   },
  // )
  // totalValorBruto?: number;

  @ApiProperty({
    description: 'Fecha de la transacción.',
    example: '2026-07-10',
    format: 'date',
  })
  @IsString({
    message: 'La fecha de operación no es válida.',
  })
  @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[-+]\d{2}:\d{2}$/, {
    message: 'Formato de fecha inválido, debe ser ISO 8601 con zona horaria',
  })
  fechaOperacion: string;

  @ApiPropertyOptional({
    description: 'Observaciones adicionales.',
    example: 'Recepción sin novedades.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255, {
    message: 'Las observaciones no pueden superar los 255 caracteres.',
  })
  observaciones?: string;

  @IsArray({
    message: 'Debe enviar el detalle de minerales.',
  })
  @ArrayMinSize(1, {
    message: 'Debe registrar al menos un mineral.',
  })
  @ValidateNested({
    each: true,
  })
  @Type(() => CreateRecepcionMineralDetalleDto)
  detalles: CreateRecepcionMineralDetalleDto[];
}
