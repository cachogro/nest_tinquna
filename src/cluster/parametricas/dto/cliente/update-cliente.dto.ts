import { Type } from 'class-transformer';
import { IsOptional, IsPositive } from 'class-validator';
import { CreateClienteDto } from './create-cliente.dto';

export class UpdateClienteDto extends CreateClienteDto {
  @IsOptional()
  @Type(() => Number)
  @IsPositive({
    message: 'El identificador del cliente no es válido.',
  })
  id?: number;
}
