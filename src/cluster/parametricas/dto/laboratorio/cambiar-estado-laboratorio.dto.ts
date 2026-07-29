import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class CambiarEstadoLaboratorioDto {
  @ApiProperty({
    example: true,
    description: 'Nuevo estado del laboratorio.',
  })
  @Type(() => Boolean)
  @IsBoolean({
    message: 'El estado debe ser verdadero o falso.',
  })
  activo: boolean;
}