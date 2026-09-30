import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsPositive } from 'class-validator';
import { CreateDestinoGastoDto } from './create-destino-gasto.dto';

export class UpdateDestinoGastoDto extends CreateDestinoGastoDto {
  @ApiProperty({ example: 1, description: 'Identificador del destino de gasto.' })
  @Type(() => Number)
  @IsPositive({ message: 'El identificador no es válido.' })
  id: number;
}
