const VARIABLES_REQUERIDAS = [
  'CI_HOST',
  'CI_PORT',
  'CI_NAME',
  'CI_USERNAME',
  'CI_PASSWORD',
  'JWT_SECRET',
  'JWT_SECRET_REFRESH',
  'JWT_EXPIRATION',
  'JWT_EXPIRATION_REFRESH',
];

const LONGITUD_MINIMA_SECRETO = 32;

/**
 * Valida las variables de entorno al arrancar la aplicación (falla rápido
 * en vez de arrancar con un JWT_SECRET vacío/débil y fallar de forma
 * impredecible en el primer login).
 */
export function validateEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const faltantes = VARIABLES_REQUERIDAS.filter((clave) => !config[clave]);
  if (faltantes.length > 0) {
    throw new Error(
      `Faltan variables de entorno obligatorias: ${faltantes.join(', ')}`,
    );
  }

  const jwtSecret = config.JWT_SECRET as string;
  const jwtSecretRefresh = config.JWT_SECRET_REFRESH as string;

  if (jwtSecret.length < LONGITUD_MINIMA_SECRETO) {
    throw new Error(
      `JWT_SECRET debe tener al menos ${LONGITUD_MINIMA_SECRETO} caracteres.`,
    );
  }

  if (jwtSecretRefresh.length < LONGITUD_MINIMA_SECRETO) {
    throw new Error(
      `JWT_SECRET_REFRESH debe tener al menos ${LONGITUD_MINIMA_SECRETO} caracteres.`,
    );
  }

  if (jwtSecret === jwtSecretRefresh) {
    throw new Error('JWT_SECRET y JWT_SECRET_REFRESH deben ser distintos.');
  }

  return config;
}
