import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDefined,
  IsInt,
  IsNotEmpty,
  Max,
  Min,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

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

  // Proveedor: se envía UNO de los tres (persona, actor productivo o nombre
  // de un externo). El kardex se decide después, al procesar el recibo.
  @ApiPropertyOptional({
    description:
      'Proveedor como persona registrada (incluye personal interno). Excluyente con idActorProductivoMinero.',
    example: '15',
  })
  @IsOptional()
  @IsString({
    message: 'El proveedor no es válido.',
  })
  idPersona?: string | null;

  @ApiPropertyOptional({
    description:
      'Proveedor como actor productivo minero. Excluyente con idPersona.',
    example: '4',
  })
  @IsOptional()
  @IsString({
    message: 'El actor productivo no es válido.',
  })
  idActorProductivoMinero?: string | null;

  @ApiPropertyOptional({
    description:
      'Nombre y apellido del proveedor cuando es un externo sin registro. Con idPersona o idActorProductivoMinero se ignora: el nombre se toma del registro.',
    example: 'JUAN MAMANI QUISPE',
  })
  @IsOptional()
  @IsString({
    message: 'El nombre del proveedor no es válido.',
  })
  @MaxLength(255, {
    message: 'El nombre del proveedor no puede exceder los 255 caracteres.',
  })
  nombresApellidos?: string | null;

  @ApiProperty({
    description:
      'Cantidad de sacos recibidos. Obligatorio para toda codificación; 0 si no aplica (ej. RAM o cargas).',
    example: 120,
  })
  @IsDefined({
    message: 'El número de sacos es obligatorio (0 si no aplica).',
  })
  @IsInt({
    message: 'El número de sacos debe ser un número entero.',
  })
  @Min(0, {
    message: 'El número de sacos no puede ser negativo.',
  })
  numeroSacos: number;

  @ApiProperty({
    description: 'Peso neto del mineral en kilogramos.',
    example: 2450.35897,
  })
  @IsNumber(
    { maxDecimalPlaces: 5 },
    {
      message: 'La balanza L debe ser un número válido (hasta 5 decimales).',
    },
  )
  @IsPositive({
    message: 'El peso neto debe ser mayor a cero.',
  })
  balanzaL: number;

  @ApiPropertyOptional({
    description: 'Peso neto del mineral en kilogramos balanza T (0 si no aplica).',
    example: 2450.35897,
  })
  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 5 },
    {
      message: 'La balanza T debe ser un número válido (hasta 5 decimales).',
    },
  )
  @Min(0, {
    message: 'El peso de balanza T no puede ser negativo.',
  })
  balanzaT?: number;

  @ApiPropertyOptional({
    description: 'Monto del anticipo entregado al proveedor.',
    example: 15000.5,
  })
  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    {
      message: 'El anticipo debe ser un número válido (hasta 2 decimales).',
    },
  )
  @Min(0, {
    message: 'El anticipo no puede ser negativo.',
  })
  anticipo?: number;

  @ApiPropertyOptional({
    description: 'Humedad referencial del mineral.',
    example: 58.75,
  })
  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 5 },
    {
      message: 'La humedad debe ser un número válido (hasta 5 decimales).',
    },
  )
  @Min(0, {
    message: 'La humedad no puede ser negativa.',
  })
  @Max(100, {
    message: 'La humedad no puede superar 100%.',
  })
  humedad?: number;

  @ApiProperty({
    description: 'Identificador del proveedor.',
    example: '15',
  })
  @IsString()
  @IsNotEmpty({
    message: 'El proveedor es obligatorio.',
  })
  idPersonalInterno: string;

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
  fechaRecepcion: string;

  @ApiPropertyOptional({
    description:
      'Lugar de acopio donde se recibió el mineral (texto). Se sugiere tomarlo de GET /parametricas/lugar-acopio.',
    example: 'GALPON',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100, {
    message: 'El lugar de acopio no puede superar los 100 caracteres.',
  })
  lugarAcopio?: string;

  @ApiPropertyOptional({
    description:
      'Identificador del laboratorio (GET /parametricas/laboratorio). Es opcional; al actualizar, enviar null lo quita.',
    example: '1',
    nullable: true,
  })
  @IsOptional()
  @IsString({
    message: 'El laboratorio no es válido.',
  })
  idLaboratorio?: string | null;

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

}
