import { ApiProperty } from '@nestjs/swagger';

export class TipoDocumentoResponseDto {
  @ApiProperty({
    example: '1',
    description: 'Código identificador del tipo de documento.',
  })
  id: string;

  @ApiProperty({
    example: 'CI',
    description: 'Nombre o descripción del tipo de documento.',
  })
  nombre: string;
}

export class EmisionDocumentoResponseDto {
  @ApiProperty({
    example: '1',
    description: 'Código identificador del lugar de emisión del documento.',
  })
  id: string;

  @ApiProperty({
    example: 'CI',
    description: 'Nombre o descripción del lugar de emisión del documento.',
  })
  nombre: string;
}
