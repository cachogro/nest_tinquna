-- Enlace opcional de una línea de kardex al recibo que la generó (mismo
-- patrón que la columna ya existente id_valorizacion).

ALTER TABLE contabilidad.movimiento_kardex
  ADD COLUMN IF NOT EXISTS id_recibo BIGINT
      REFERENCES contabilidad.recibo (id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_movimiento_kardex_recibo
    ON contabilidad.movimiento_kardex (id_recibo);
