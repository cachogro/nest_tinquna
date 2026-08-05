/**
 * Convierte el valor crudo de un query param ('true'/'false'/boolean/undefined)
 * a boolean real, para usar como callback de `@Transform` en filtros como
 * `activo` o `vigente`. Cualquier valor que no sea exactamente 'true'/'false'
 * (como string) o un boolean se resuelve como `undefined` (filtro no aplicado).
 */
export function parseBooleanQueryParam({
  value,
}: {
  value: unknown;
}): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalizado = value.toLowerCase();
    if (normalizado === 'true') return true;
    if (normalizado === 'false') return false;
  }
  return undefined;
}
