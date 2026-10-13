-- destino_gasto pasa de texto libre a un catálogo formal
-- (parametrica.destino_gasto), poblado a partir del Excel real.

ALTER TABLE contabilidad.movimiento_caja
  DROP COLUMN IF EXISTS destino_gasto,
  ADD COLUMN IF NOT EXISTS id_destino_gasto INTEGER
      REFERENCES parametrica.destino_gasto (id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_movimiento_caja_destino_gasto
    ON contabilidad.movimiento_caja (id_destino_gasto);
