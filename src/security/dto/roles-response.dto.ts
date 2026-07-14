import { ApiProperty } from '@nestjs/swagger';

export class RolResponseDto {
  @ApiProperty({
    example: '1',
    description: 'Código identificador del rol.',
  })
  id: string;

  @ApiProperty({
    example: 'OPERADOR',
    description: 'Nombre o descripción del rol.',
  })
  nombre: string;
}
