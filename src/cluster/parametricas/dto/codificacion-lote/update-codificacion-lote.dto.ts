import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsPositive } from 'class-validator';
import { CreateCodificacionLoteDto } from './create-codificacion-lote.dto';

export class UpdateCodificacionLoteDto extends CreateCodificacionLoteDto {
  @ApiProperty({ example: 1, description: 'Identificador de la codificación de lote.' })
  @Type(() => Number)
  @IsPositive({ message: 'El identificador no es válido.' })
  id: number;
}
