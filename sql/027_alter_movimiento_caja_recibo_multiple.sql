-- Un recibo puede generar HASTA DOS movimientos en la caja de flujo, no uno
-- solo: un INGRESO por la porción que se aplicó a kardex (personal + actor,
-- siempre representa valor recuperado por la empresa) y un EGRESO por la
-- porción EFECTIVO (dinero que realmente sale de caja en el momento). Por
-- eso se retira el FK único id_movimiento_caja de recibo y se agrega
-- id_recibo en movimiento_caja (mismo patrón que movimiento_kardex.id_recibo).

ALTER TABLE contabilidad.recibo
  DROP COLUMN IF EXISTS id_movimiento_caja;

ALTER TABLE contabilidad.movimiento_caja
  ADD COLUMN IF NOT EXISTS id_recibo BIGINT
      REFERENCES contabilidad.recibo (id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_movimiento_caja_recibo
    ON contabilidad.movimiento_caja (id_recibo);
