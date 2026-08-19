import { ApiProperty } from '@nestjs/swagger';

export class TokenResponseDto {
  @ApiProperty({ description: 'Nuevo token de acceso' })
  token: string;

  @ApiProperty({ description: 'Nuevo token de refresco' })
  refreshToken: string;
}