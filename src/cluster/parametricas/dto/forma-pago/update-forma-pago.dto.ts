import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsPositive } from 'class-validator';
import { CreateFormaPagoDto } from './create-forma-pago.dto';

export class UpdateFormaPagoDto extends CreateFormaPagoDto {
  @ApiProperty({
    example: 1,
    description: 'Identificador de la forma de pago.',
  })
  @Type(() => Number)
  @IsPositive({
    message: 'El identificador no es válido.',
  })
  id: number;
}
