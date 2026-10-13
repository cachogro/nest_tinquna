-- La caja de flujo (parametrica.caja / contabilidad.movimiento_caja) pasa a
-- ser el registro maestro de la empresa: reemplaza a la línea espejo que
-- antes se generaba en un Kardex de actor id=1. Un recibo ya no genera esa
-- línea de kardex "de la empresa"; en su lugar, genera un movimiento en la
-- caja de flujo por el TOTAL del recibo (INGRESO si tipo=INGRESO, EGRESO si
-- tipo=EGRESO), después de postear las líneas HABER en los kardex
-- personal/actor de cada detalle.

ALTER TABLE contabilidad.recibo
  DROP COLUMN IF EXISTS id_movimiento_kardex_empresa,
  ADD COLUMN IF NOT EXISTS id_movimiento_caja BIGINT
      REFERENCES contabilidad.movimiento_caja (id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_recibo_movimiento_caja
    ON contabilidad.recibo (id_movimiento_caja);
