import { ApiProperty } from '@nestjs/swagger';
import { Usuario } from 'src/security/entities/usuario.entity';


export class AuthResponseDto {
  @ApiProperty({ description: 'Token de acceso JWT' })
  access_token: string;

  @ApiProperty({ description: 'Token de refresco JWT' })
  refresh_token: string;

  @ApiProperty({ description: 'Datos del usuario autenticado', type: Usuario })
  user: Usuario;
}