-- Se elimina parametrica.tipo_movimiento_kardex (ANTICIPO, PAGO, TRANZADO,
-- DEVOLUCION...): sus categorías genéricas quedan reemplazadas por
-- parametrica.destino_gasto, que ya tiene descripciones más específicas y
-- diferenciadas por ingreso/egreso (es_egreso). destino_gasto pasa a ser el
-- clasificador único, usado tanto en líneas de kardex como en movimientos
-- de caja y en la cabecera del recibo.

-- 1) movimiento_kardex: id_tipo_movimiento -> id_destino_gasto
ALTER TABLE contabilidad.movimiento_kardex
  DROP COLUMN IF EXISTS id_tipo_movimiento,
  ADD COLUMN IF NOT EXISTS id_destino_gasto INTEGER
      REFERENCES parametrica.destino_gasto (id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_movimiento_kardex_destino_gasto
    ON contabilidad.movimiento_kardex (id_destino_gasto);

-- 2) recibo: id_tipo_movimiento -> id_destino_gasto (antes solo se usaba de
--    paso para los movimientos de caja; ahora se persiste en la cabecera y
--    se aplica también a las líneas de kardex que genera).
ALTER TABLE contabilidad.recibo
  DROP COLUMN IF EXISTS id_tipo_movimiento,
  ADD COLUMN IF NOT EXISTS id_destino_gasto INTEGER
      REFERENCES parametrica.destino_gasto (id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_recibo_destino_gasto
    ON contabilidad.recibo (id_destino_gasto);

-- 3) Ya no queda ninguna FK apuntando a tipo_movimiento_kardex: se elimina.
DROP TABLE IF EXISTS parametrica.tipo_movimiento_kardex;
