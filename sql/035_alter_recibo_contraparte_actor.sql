-- La contraparte física del recibo ("Recibí de" / "Entregué a") puede ser
-- una persona registrada (id_persona), un actor productivo minero
-- (id_actor_productivo_minero), o texto libre (nombres_apellidos) — solo
-- una de las tres. El destino real de cada porción (a quién se le salda la
-- deuda) sigue viviendo en recibo_detalle, esto es solo para la impresión.

ALTER TABLE contabilidad.recibo
  ADD COLUMN IF NOT EXISTS id_actor_productivo_minero BIGINT
      REFERENCES parametrica.actor_productivo_minero (id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_recibo_actor_productivo_minero
    ON contabilidad.recibo (id_actor_productivo_minero);
