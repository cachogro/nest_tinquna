import {
  CanActivate,
  ExecutionContext,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable } from 'rxjs';

/**
 * Guard para validar un token estático en el header 'x-static-token'
 * Este guard se usa para endpoints que requieren autenticación simple sin JWT.
 * El token se lee de la variable de entorno STATIC_TOKEN (nunca hardcodeado).
 */
@Injectable()
export class StaticTokenGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();

    const tokenEsperado = this.configService.get<string>('STATIC_TOKEN');
    if (!tokenEsperado) {
      throw new InternalServerErrorException(
        'STATIC_TOKEN no está configurado en el servidor',
      );
    }

    // Obtener el token del header 'x-static-token'
    const token = request.headers['x-static-token'];

    // Validar que el token existe
    if (!token) {
      throw new UnauthorizedException(
        'Token estático requerido. Incluya el header "x-static-token"',
      );
    }

    // Validar que el token es correcto
    if (token !== tokenEsperado) {
      throw new UnauthorizedException('Token estático inválido');
    }

    // Si el token es válido, permitir el acceso
    return true;
  }
}
