import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Abre el PRIMER kardex (N° 1) de un actor o de una persona. Los siguientes
 * (N° 2, N° 3...) se generan solos al cerrar el anterior.
 */
export class AbrirKardexDto {
  @ApiProperty({
    enum: ['ACTOR', 'PERSONAL'],
    example: 'ACTOR',
    description:
      'ACTOR: kardex del actor productivo (cubre a todas sus personas). PERSONAL: kardex individual de una persona.',
  })
  @IsIn(['ACTOR', 'PERSONAL'], { message: 'El tipo debe ser ACTOR o PERSONAL.' })
  tipo: 'ACTOR' | 'PERSONAL';

  @ApiPropertyOptional({
    example: '5',
    description: 'Id del actor productivo minero. Obligatorio si tipo = ACTOR.',
  })
  @IsOptional()
  @IsString({ message: 'El id del actor productivo minero debe ser una cadena de texto.' })
  idActorProductivoMinero?: string;

  @ApiPropertyOptional({
    example: '15',
    description: 'Id de la persona (persona_ci). Obligatorio si tipo = PERSONAL.',
  })
  @IsOptional()
  @IsString({ message: 'El id de la persona debe ser una cadena de texto.' })
  idPersona?: string;

  @ApiPropertyOptional({
    example: 'ANTICIPOS A CTA SACOS DE MINERAL',
    description: 'Título / cuenta del kardex. Se guarda en MAYÚSCULAS.',
  })
  @IsOptional()
  @IsString({ message: 'La descripción debe ser una cadena de texto.' })
  @MaxLength(150, { message: 'La descripción no puede exceder los 150 caracteres.' })
  descripcion?: string;

  @ApiPropertyOptional({
    example: 2026,
    description: 'Gestión (año) de apertura. Por defecto, el año actual.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  gestion?: number;

  @ApiPropertyOptional({
    example: 3500,
    description:
      'Saldo / deuda con el que arranca el kardex (migrado del Excel). Solo para el primer kardex; por defecto 0.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El saldo inicial debe ser numérico con hasta 2 decimales.' },
  )
  saldoInicial?: number;
}
