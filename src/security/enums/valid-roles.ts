export enum ValidRoles {
  administrador = 'ROLE_ADMINISTRADOR',
  operador = 'ROLE_OPERADOR',
  tecnico = 'ROLE_TECNICO',
  supervisor = 'ROLE_SUPERVISOR',
  consulta = 'ROLE_CONSULTA',
}

export enum ID_ROLES {
  ADMINISTRADOR = 1,
  OPERADOR = 2,
  TECNICO = 3,
  SUPERVISOR = 4,
  CONSULTA = 5,
}

/**
 * Roles que pueden usar cada módulo. Es el espejo de PERMISOS_MODULO del
 * front (core/auth/models/permisos-modulo.ts): si se cambia uno, cambiar el
 * otro. Se usa con @RoleProtected(...) en la clase del controlador o con
 * @Auth(...) en una ruta puntual (la ruta manda sobre la clase).
 */
export class RolesModules {
  static readonly comercioInterno = [
    ValidRoles.administrador,
    ValidRoles.tecnico,
  ];

  static readonly contabilidad = [
    ValidRoles.administrador,
    ValidRoles.operador,
  ];

  // Operador: solo Paramétricas y Actores y Clientes (usuarios y bitácora
  // siguen siendo solo administrador, ver admin.controller.ts).
  static readonly configuraciones = [
    ValidRoles.administrador,
    ValidRoles.operador,
  ];

  /**
   * Rutas "comercio_interno/*" del back. Además del módulo Comercio Interno
   * las consumen Contabilidad (personas, actores y valorizaciones) y
   * Configuraciones (Actores y Clientes), por eso suma al operador.
   */
  static readonly comercioInternoApi = [
    ...RolesModules.comercioInterno,
    ValidRoles.operador,
  ];
}
