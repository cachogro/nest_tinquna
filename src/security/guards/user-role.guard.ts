import { Reflector } from '@nestjs/core';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { META_ROLES } from '../decorators/role-protected.decorator';
import { Usuario } from '../entities/usuario.entity';

@Injectable()
export class UserRoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    // Los roles de la ruta mandan; si la ruta no pide ninguno (@Auth() a
    // secas) se usan los del controlador (@RoleProtected en la clase).
    const rolesRuta: string[] = this.reflector.get(
      META_ROLES,
      context.getHandler(),
    );
    const validRoles: string[] = rolesRuta?.length
      ? rolesRuta
      : this.reflector.get(META_ROLES, context.getClass());

    if (!validRoles) return true;
    if (validRoles.length === 0) return true;

    const req = context.switchToHttp().getRequest();
    const usuario = req.user as Usuario;

    if (!usuario) throw new BadRequestException('Usuario no encontrado');

    for (const role of usuario.roles) {
      if (validRoles.includes(role.codigo)) {
        return true;
      }
    }

    throw new ForbiddenException(
      `El usuario ${usuario.persona.nombres} necesita: [${validRoles}]`,
    );
  }
}
