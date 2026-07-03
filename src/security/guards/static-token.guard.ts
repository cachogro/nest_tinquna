import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Observable } from 'rxjs';

/**
 * Guard para validar un token estático en el header 'x-static-token'
 * Este guard se usa para endpoints que requieren autenticación simple sin JWT
 */
@Injectable()
export class StaticTokenGuard implements CanActivate {
  // Token estático JWT del usuario
  private readonly STATIC_TOKEN =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTMsImlhdCI6MTc2NTU2NzMyOCwiZXhwIjoxNzY1NTcwOTI4fQ.mltQpjyF';

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();

    // Obtener el token del header 'x-static-token'
    const token = request.headers['x-token'];

    // Validar que el token existe
    if (!token) {
      throw new UnauthorizedException(
        'Token estático requerido. Incluya el header "x-token"',
      );
    }

    // Validar que el token es correcto
    if (token !== this.STATIC_TOKEN) {
      throw new UnauthorizedException('Token estático inválido');
    }

    // Si el token es válido, permitir el acceso
    return true;
  }
}
