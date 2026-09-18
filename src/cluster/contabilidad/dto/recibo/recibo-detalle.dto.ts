import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

export class ReciboDetalleDto {
  @ApiProperty({
    enum: ['PERSONAL', 'ACTOR', 'EFECTIVO'],
    example: 'PERSONAL',
    description:
      'A qué se destina esta porción: PERSONAL (salda deuda existente, HABER en el kardex de una persona), ACTOR (ídem, kardex de un actor productivo minero), o EFECTIVO (plata entregada directamente, sin saldar ninguna deuda). Una línea EFECTIVO puede opcionalmente traer `idPersona` o `idActorProductivoMinero` de alguien que sí tenga kardex abierto: en ese caso se registra además como un anticipo nuevo (DEBE) en su kardex.',
  })
  @IsIn(['PERSONAL', 'ACTOR', 'EFECTIVO'], {
    message: 'El destino debe ser PERSONAL, ACTOR o EFECTIVO.',
  })
  destino: 'PERSONAL' | 'ACTOR' | 'EFECTIVO';

  @ApiPropertyOptional({
    example: '20',
    description:
      'Id de la persona (persona_ci). Obligatorio si destino=PERSONAL (HABER, salda deuda). Opcional si destino=EFECTIVO: si la persona tiene kardex abierto, se registra como anticipo nuevo (DEBE). Excluyente con idActorProductivoMinero.',
  })
  @IsOptional()
  @IsString({ message: 'El id de la persona debe ser una cadena de texto.' })
  idPersona?: string;

  @ApiPropertyOptional({
    example: '4',
    description:
      'Id del actor productivo minero. Obligatorio si destino=ACTOR (HABER, salda deuda). Opcional si destino=EFECTIVO: si el actor tiene kardex abierto, se registra como anticipo nuevo (DEBE). Excluyente con idPersona.',
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

  @ApiPropertyOptional({
    example: 8,
    description:
      'Id del destino del gasto (parametrica.destino_gasto) que clasifica esta porción. Se aplica tanto a la línea de kardex como al movimiento de caja de flujo que genera esta línea (cada línea puede tener un destino distinto).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive({ message: 'El destino del gasto no es válido.' })
  idDestinoGasto?: number;
}
