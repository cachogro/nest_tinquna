import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { CreateValorizacionMineralDetalleDto } from './create-valorizacion-mineral-detalle.dto';
import { CreateValorizacionCalculoAporteDto } from './create-valorizacion-calculo-aporte.dto';
import { CreateValorizacionCalculoDto } from './create-valorizacion-calculo.dto';

/**
 * DTO para PATCH /comercio_interno/valorizacion_mineral/:id
 *
 * Todos los campos son opcionales: se puede llamar varias veces enviando
 * solo lo que se quiera actualizar en ese momento (laboratorio, pesos,
 * económicos, detalles, aportes, o el cambio de estado).
 *
 * - Si se envía `detalles`, se da de baja lógica el detalle anterior y se
 *   crea uno nuevo con lo enviado.
 * - Si se envía `aportes`, se aplica el mismo criterio de baja lógica + alta.
 * - Si se envía `idEstadoValorizacion` = VALORIZADO (3), el servicio valida
 *   que la información mínima esté completa y, de ser así, la recepción de
 *   mineral pasa a TRANZADO y deja de poder modificarse.
 */
export class UpdateValorizacionMineralDto {
  @ApiPropertyOptional({
    description: 'Id del laboratorio que realizó el análisis.',
    example: 1,
  })
  @IsOptional()
  @IsString()
  idLaboratorio?: string;

  @ApiPropertyOptional({
    description:
      'Id del nuevo estado de la valorización (parametrica.estado_valorizacion). ' +
      '1 = BORRADOR, 2 = PRE-VALORIZADO, 3 = VALORIZADO.',
    example: 2,
  })
  @IsOptional()
  @IsInt()
  idEstadoValorizacion?: number;

  @ApiPropertyOptional({
    description: 'Fecha en la que se realiza la valorización.',
    example: '2026-07-29',
  })
  @IsOptional()
  @IsDateString()
  fechaValorizacion?: string;

  // ============================
  // Pesos y merma (calculados en el front)
  // ============================

  @ApiPropertyOptional({ example: 636.0 })
  @IsOptional()
  @IsNumber()
  pesoBrutoHumedoKilogramos?: number;

  @ApiPropertyOptional({
    description:
      'Peso bruto seco (ej. PSB = PHB - agua). Solo aplica a codificaciones que descuentan humedad antes de la merma (ej. BCL); en otras queda sin enviar/null.',
    example: 615.0,
  })
  @IsOptional()
  @IsNumber()
  pesoBrutoSecoKilogramos?: number;

  // @ApiPropertyOptional({ example: 621.0 })
  // @IsOptional()
  // @IsNumber()
  // pesoNetoHumedoKilogramos?: number;

  @ApiPropertyOptional({ example: 615.0 })
  @IsOptional()
  @IsNumber()
  pesoNetoSecoKilogramos?: number;

  @ApiPropertyOptional({ example: 15.0 })
  @IsOptional()
  @IsNumber()
  taraKilogramos?: number;

  @ApiPropertyOptional({ example: 1.0 })
  @IsOptional()
  @IsNumber()
  humedadPorcentaje?: number;

  @ApiPropertyOptional({ example: 0.94 })
  @IsOptional()
  @IsNumber()
  mermaPorcentaje?: number;

  @ApiPropertyOptional({ example: 6.0 })
  @IsOptional()
  @IsNumber()
  mermaKilogramos?: number;

  // ============================
  // Valores económicos (calculados en el front)
  // ============================

  @ApiPropertyOptional({ example: 45250.5 })
  @IsOptional()
  @IsNumber()
  totalValorBrutoBolivianos?: number;

  @ApiPropertyOptional({ example: 452.5 })
  @IsOptional()
  @IsNumber()
  totalAportesBolivianos?: number;

  @ApiPropertyOptional({ example: 6.96 })
  @IsOptional()
  @IsNumber()
  cotizacionDolar?: number;

  @ApiPropertyOptional({
    description: 'Costo de ajusteTransporte. Puede ser negativo, positivo o cero.',
    example: -50.0,
  })
  @IsOptional()
  @IsNumber()
  ajusteTransporte?: number;

  @ApiPropertyOptional({ example: 135.0 })
  @IsOptional()
  @IsNumber()
  anticipo?: number;

  @ApiPropertyOptional({
    description: 'Otros anticipos. Debe ser 0 o mayor, no puede ser negativo.',
    example: 50.0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  otrosAnticipo?: number;

  @ApiPropertyOptional({ example: 44663.0 })
  @IsOptional()
  @IsNumber()
  totalValorLiquidoVentaBolivianos?: number;

  @ApiPropertyOptional({ example: 6413.5 })
  @IsOptional()
  @IsNumber()
  totalValorLiquidoVentaUsd?: number;

  @ApiPropertyOptional({ example: 44663.0 })
  @IsOptional()
  @IsNumber()
  totalValorNetoVentaBolivianos?: number;

  @ApiPropertyOptional({
    description: 'Valor de la tonelada en bolivianos. Solo aplica a RAM cargas.',
    example: 1.5421,
  })
  @IsOptional()
  @IsNumber()
  totalValorToneladaBolivianos?: number;

  @ApiPropertyOptional({
    description: 'Valor de la tonelada en USD. Solo aplica a RAM cargas.',
    example: 224.8,
  })
  @IsOptional()
  @IsNumber()
  totalValorToneladaUsd?: number;

  @ApiPropertyOptional({ example: 'Sin observaciones.' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  observaciones?: string;

  // ============================
  // Detalle y aportes
  // ============================

  @ApiPropertyOptional({
    description:
      'Detalle de leyes por mineral. Si la codificación de la recepción tiene ' +
      'minerales registrados, todos ellos deben estar presentes (se permiten ' +
      'minerales adicionales para casos de carga). Al enviarse, reemplaza ' +
      '(da de baja lógica) el detalle anterior.',
    type: [CreateValorizacionMineralDetalleDto],
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateValorizacionMineralDetalleDto)
  detalles?: CreateValorizacionMineralDetalleDto[];

  @ApiPropertyOptional({
    description:
      'Aportes a entidades (ya calculados por el front). Al enviarse, ' +
      'reemplaza (da de baja lógica) los aportes anteriores.',
    type: [CreateValorizacionCalculoAporteDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateValorizacionCalculoAporteDto)
  aportes?: CreateValorizacionCalculoAporteDto[];

  @ApiPropertyOptional({
    description:
      'Señal explícita para vaciar los aportes: si es true, se dan de baja ' +
      'lógica todos los aportes activos, sin importar si se envía o no el ' +
      'arreglo "aportes". Si no se envía (o es false), y tampoco se manda ' +
      '"aportes", los aportes existentes se mantienen tal cual.',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  limpiarAportes?: boolean;

  // ============================
  // Cálculos (maquila, ajustes, penalidades)
  // ============================

  @ApiPropertyOptional({
    description:
      'Cálculos de la valorización (maquila, ajuste de maquila, penalidades por elemento, etc). ' +
      'No es obligatorio: depende de la codificación de la recepción (algunas no usan este desglose). ' +
      'Al enviarse, reemplaza (da de baja lógica) los cálculos anteriores.',
    type: [CreateValorizacionCalculoDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateValorizacionCalculoDto)
  calculos?: CreateValorizacionCalculoDto[];

  @ApiPropertyOptional({
    description:
      'Señal explícita para vaciar los cálculos: si es true, se dan de baja ' +
      'lógica todos los cálculos activos, sin importar si se envía o no el ' +
      'arreglo "calculos". Si no se envía (o es false), y tampoco se manda ' +
      '"calculos", los cálculos existentes se mantienen tal cual.',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  limpiarCalculos?: boolean;
}
