import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class ReciboDetalleDto {
  @ApiProperty({
    enum: ['PERSONAL', 'ACTOR', 'EFECTIVO'],
    example: 'PERSONAL',
    description:
      'A qué se destina esta porción: kardex PERSONAL de una persona, kardex de un ACTOR productivo minero, o EFECTIVO entregado directamente (sin kardex propio).',
  })
  @IsIn(['PERSONAL', 'ACTOR', 'EFECTIVO'], {
    message: 'El destino debe ser PERSONAL, ACTOR o EFECTIVO.',
  })
  destino: 'PERSONAL' | 'ACTOR' | 'EFECTIVO';

  @ApiPropertyOptional({
    example: '20',
    description: 'Id de la persona (persona_ci). Obligatorio si destino=PERSONAL.',
  })
  @IsOptional()
  @IsString({ message: 'El id de la persona debe ser una cadena de texto.' })
  idPersona?: string;

  @ApiPropertyOptional({
    example: '4',
    description:
      'Id del actor productivo minero. Obligatorio si destino=ACTOR.',
  })
  @IsOptional()
  @IsString({ message: 'El id del actor productivo minero debe ser una cadena de texto.' })
  idActorProductivoMinero?: string;

  @ApiProperty({ example: 100, description: 'Monto de esta porción (mayor a 0).' })
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El monto debe ser numérico con hasta 2 decimales.' },
  )
  @IsPositive({ message: 'El monto debe ser mayor a 0.' })
  monto: number;
}
