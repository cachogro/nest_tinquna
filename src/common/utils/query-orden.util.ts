import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';

/**
 * Aplica el ordenamiento a un query builder a partir de un mapa
 * "nombre de filtro" -> "columna real (con alias)". Si `orderBy` no está en
 * el mapa (no debería pasar si el DTO valida con `@IsIn`), se ordena por la
 * primera columna del mapa como resguardo.
 */
export function aplicarOrden<T extends ObjectLiteral>(
  query: SelectQueryBuilder<T>,
  columnasOrden: Record<string, string>,
  orderBy: string,
  orderDirection: 'ASC' | 'DESC',
): SelectQueryBuilder<T> {
  const columna = columnasOrden[orderBy] ?? Object.values(columnasOrden)[0];
  return query.orderBy(columna, orderDirection);
}
