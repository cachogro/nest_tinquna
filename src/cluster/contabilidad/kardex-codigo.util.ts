import { TipoKardex } from './entities/kardex.entity';

const LETRA_TIPO: Record<TipoKardex, string> = {
  ACTOR: 'A',
  ASOCIADO: 'S',
  PERSONAL: 'P',
  CLIENTE: 'C',
};

/**
 * Código del kardex: K<tipo>-<correlativo>, ej. "KA-001", "KP-002".
 *   - <tipo>: A = ACTOR, S = ASOCIADO, P = PERSONAL, C = CLIENTE.
 *   - <correlativo>: numeración propia de cada sigla, en orden de creación.
 * El mismo formato arma el backfill de sql/082_alter_kardex_codigo.sql.
 */
export function generarCodigoKardex(
  tipo: TipoKardex,
  correlativo: number,
): string {
  return `K${LETRA_TIPO[tipo]}-${String(correlativo).padStart(3, '0')}`;
}
