import { ApiProperty } from '@nestjs/swagger';
import { Usuario } from 'src/security/entities/usuario.entity';


export class AuthResponseDto {
  @ApiProperty({ description: 'Token de acceso JWT' })
  token: string;

  @ApiProperty({ description: 'Token de refresco JWT' })
  refreshToken: string;

  @ApiProperty({ description: 'Datos del usuario autenticado', type: Usuario })
  user: Usuario;
}