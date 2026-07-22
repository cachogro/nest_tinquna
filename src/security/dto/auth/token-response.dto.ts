import { ApiProperty } from '@nestjs/swagger';

export class TokenResponseDto {
  @ApiProperty({ description: 'Nuevo token de acceso' })
  access_token: string;

  @ApiProperty({ description: 'Nuevo token de refresco' })
  refresh_token: string;
}