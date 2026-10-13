import { RolesModules, ValidRoles } from './valid-roles';

/**
 * Permisos de pantalla que se asignan a los roles desde
 * Configuraciones > Roles y Permisos. El catálogo (código, nombre, módulo)
 * vive en seguridad.permiso; acá solo se define a qué roles se les PUEDE
 * otorgar cada uno.
 *
 * Los permisos deciden qué ve y qué puede tocar cada rol en el front. Las
 * rutas del back se protegen con RolesModules; solo las que llevan
 * @RequierePermiso / @RequierePermisoExcel exigen además el permiso (hoy,
 * las descargas en Excel de los reportes de Contabilidad). Por eso la
 * matriz nunca ofrece una pantalla a un rol que el back rechazaría: la lista
 * de cada permiso son los roles que pueden usar todas las rutas que esa
 * pantalla llama.
 *
 * El administrador tiene siempre todos los permisos (no se guardan ni se
 * pueden quitar).
 */
/**
 * Descargar los reportes de Contabilidad en EXCEL. Es un permiso de acción,
 * no de pantalla: lo exige el back en cada ruta de descarga
 * (@RequierePermisoExcel) además de ocultar el botón en el front. El PDF de
 * esos reportes es libre para cualquier rol que entre a la pantalla.
 */
export const PERMISO_DESCARGAR_EXCEL_CONTABILIDAD =
  'contabilidad.descargar_excel';

export const ROLES_PERMITIDOS_POR_PERMISO: Record<string, ValidRoles[]> = {
  // Comercio Interno
  'comercio.recepcion': RolesModules.comercioInternoApi,
  'comercio.recepcion.gestionar': RolesModules.comercioInternoApi,
  // Registra cotizaciones y escalas de precio (paramétricas) y paga la
  // valorización (contabilidad): sin técnico.
  'comercio.valorizacion': RolesModules.contabilidad,
  'comercio.promedios': RolesModules.comercioInternoApi,
  // Usa las rutas "contabilidad/venta-lote".
  'comercio.ventas_lote': RolesModules.contabilidad,
  'comercio.reportes': RolesModules.comercioInternoApi,

  // Contabilidad
  'contabilidad.recibos': RolesModules.contabilidad,
  'contabilidad.traspasos': RolesModules.contabilidad,
  'contabilidad.fondo_rendir': RolesModules.contabilidad,
  'contabilidad.libreta_bancaria': RolesModules.contabilidad,
  'contabilidad.kardex': RolesModules.contabilidad,
  'contabilidad.caja_flujo': RolesModules.contabilidad,
  'contabilidad.prestamos': RolesModules.contabilidad,
  'contabilidad.boletas_pago': RolesModules.contabilidad,
  'contabilidad.reporte_plan_cuentas': RolesModules.contabilidad,
  [PERMISO_DESCARGAR_EXCEL_CONTABILIDAD]: RolesModules.contabilidad,

  // Configuraciones
  'config.actores_clientes': RolesModules.configuraciones,
  'config.parametricas': RolesModules.configuraciones,
  'config.usuarios': [ValidRoles.administrador],
  'config.historial_accesos': [ValidRoles.administrador],
  'config.roles_permisos': [ValidRoles.administrador],
};

/** Orden en que se muestran los módulos en la matriz. */
export const ORDEN_MODULOS_PERMISO = [
  'COMERCIO INTERNO',
  'CONTABILIDAD',
  'CONFIGURACIONES',
];
