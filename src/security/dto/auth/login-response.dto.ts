export class LoginResponseDto {
  usuario: string;

  nombres: string;

  accessToken: string;

  refreshToken: string;

  roles: string[];

  permisos: string[];

  cambioClave: boolean;
}