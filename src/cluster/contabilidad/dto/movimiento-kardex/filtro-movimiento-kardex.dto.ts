import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class FiltroMovimientoKardexDto {
  @ApiProperty({ example: '3', description: 'Id del kardex (obligatorio).' })
  @IsString({ message: 'El kardex no es válido.' })
  @IsNotEmpty({ message: 'El kardex es obligatorio.' })
  idKardex: string;
}
