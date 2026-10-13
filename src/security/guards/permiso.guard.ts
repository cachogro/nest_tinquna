import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  META_PERMISOS,
  META_PERMISOS_SOLO_EXCEL,
} from '../decorators/requiere-permiso.decorator';
import { Usuario } from '../entities/usuario.entity';
import { PermisoService } from '../service/permiso.service';

/**
 * Exige que el usuario tenga al menos uno de los permisos de la ruta
 * (@RequierePermiso). Los permisos se leen de la base en cada pedido, así un
 * cambio hecho en Roles y Permisos rige de inmediato. Va después de @Auth():
 * necesita el usuario ya autenticado.
 */
@Injectable()
export class PermisoGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permisoService: PermisoService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requeridos: string[] = this.reflector.get(
      META_PERMISOS,
      context.getHandler(),
    );
    if (!requeridos || requeridos.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    // @RequierePermisoExcel: el PDF del mismo reporte es libre.
    const soloExcel = this.reflector.get<boolean>(
      META_PERMISOS_SOLO_EXCEL,
      context.getHandler(),
    );
    if (soloExcel && String(request.query?.formato ?? '').toUpperCase() === 'PDF') {
      return true;
    }

    const usuario = request.user as Usuario;
    if (!usuario) {
      throw new ForbiddenException('Usuario no autenticado.');
    }

    const propios = await this.permisoService.codigosDeUsuario(usuario);
    if (requeridos.some((codigo) => propios.includes(codigo))) {
      return true;
    }

    throw new ForbiddenException(
      soloExcel
        ? 'Tu rol no tiene permiso para descargar este reporte en Excel (sí podés descargarlo en PDF). Pedile al administrador que lo habilite en Roles y Permisos.'
        : 'Tu rol no tiene permiso para esta acción. Pedile al administrador que lo habilite en Roles y Permisos.',
    );
  }
}
