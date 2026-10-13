import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { PermisoGuard } from '../guards/permiso.guard';

export const META_PERMISOS = 'permisos';
export const META_PERMISOS_SOLO_EXCEL = 'permisos_solo_excel';

/**
 * La ruta exige al menos uno de estos permisos (códigos de
 * enums/permisos.ts), además de lo que pida @Auth(). Ponerlo ARRIBA de
 * @Auth(): los decoradores se aplican de abajo hacia arriba y este guard
 * tiene que correr después del que autentica.
 *
 *   @RequierePermiso(PERMISO.ALGO)
 *   @Get('ruta')
 *   @Auth()
 *
 * (en la práctica: en la línea de arriba del @Get o entre @Get y @Auth; lo
 * que importa es que quede por encima de @Auth).
 */
export function RequierePermiso(...codigos: string[]) {
  return applyDecorators(
    SetMetadata(META_PERMISOS, codigos),
    UseGuards(PermisoGuard),
  );
}

/**
 * Como @RequierePermiso, pero para las rutas de reporte que sirven Excel y
 * PDF según `?formato=`: el permiso solo se exige al pedir el Excel (el
 * formato por defecto). Con `formato=PDF` pasa cualquier usuario que la
 * ruta ya admita.
 */
export function RequierePermisoExcel(...codigos: string[]) {
  return applyDecorators(
    SetMetadata(META_PERMISOS, codigos),
    SetMetadata(META_PERMISOS_SOLO_EXCEL, true),
    UseGuards(PermisoGuard),
  );
}
