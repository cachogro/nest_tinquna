import {
  FindOptionsRelations,
  FindOptionsWhere,
  In,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';

/**
 * Pagina una entidad cuyo query de filtrado hace join a una relación
 * *-a-muchos (ej. `usuario.roles`, `persona.personaTipos`). Hacer
 * `LIMIT/OFFSET` directamente sobre ese join duplica una fila por cada
 * relación extra que tenga el registro, lo que descuadra la página y el
 * orden (el "último registro" puede no aparecer primero, o no aparecer en
 * la página en absoluto).
 *
 * Por eso primero se obtienen solo los ids de la página (`DISTINCT` +
 * `OFFSET/LIMIT`, sin seleccionar columnas de la relación problemática), y
 * luego se hidratan las entidades completas por id, reordenándolas según
 * ese resultado (`In()` no garantiza el orden).
 *
 * IMPORTANTE: `queryFiltrado` debe traer el `ORDER BY` ya aplicado (p. ej.
 * con `aplicarOrden`) usando solo columnas del alias raíz (`aliasRaiz`) u
 * otras relaciones *-a-uno; ordenar por una columna de la relación
 * *-a-muchos reintroduce el problema que esta función evita.
 */
export async function paginarConJoinMultiple<T extends { id: string }>(
  queryFiltrado: SelectQueryBuilder<T>,
  aliasRaiz: string,
  repository: Repository<T>,
  page: number,
  limit: number,
  relations?: FindOptionsRelations<T>,
): Promise<{ data: T[]; total: number }> {
  // El ORDER BY del query filtrado no sirve (ni es válido) para el COUNT:
  // Postgres rechaza un ORDER BY sobre una columna no agregada cuando el
  // SELECT es un agregado puro sin GROUP BY, así que se limpia con orderBy().
  const { total: totalCrudo } = await queryFiltrado
    .clone()
    .orderBy()
    .select(`COUNT(DISTINCT ${aliasRaiz}.id)`, 'total')
    .getRawOne<{ total: string }>();
  const total = Number(totalCrudo);

  const idsPagina = await queryFiltrado
    .clone()
    .select(`${aliasRaiz}.id`, 'id')
    .distinct(true)
    .offset((page - 1) * limit)
    .limit(limit)
    .getRawMany<{ id: string }>();

  if (idsPagina.length === 0) {
    return { data: [], total };
  }

  const ids = idsPagina.map((fila) => fila.id);
  const entidades = await repository.find({
    where: { id: In(ids) } as FindOptionsWhere<T>,
    relations,
  });
  const porId = new Map(entidades.map((entidad) => [entidad.id, entidad]));

  const data = ids
    .map((id) => porId.get(id))
    .filter((entidad): entidad is T => !!entidad);

  return { data, total };
}
