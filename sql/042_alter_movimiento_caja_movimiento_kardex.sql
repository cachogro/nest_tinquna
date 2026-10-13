-- Un movimiento de kardex cargado directamente (no vía recibo) ahora
-- también postea un movimiento en la caja de flujo (Caja id=1, "CAJA
-- PRINCIPAL"): DEBE (anticipo) -> EGRESO, HABER (pago) -> INGRESO.
-- id_movimiento_kardex enlaza ese movimiento de caja de vuelta al
-- movimiento de kardex que lo generó (mismo patrón que movimiento_caja.id_recibo).

ALTER TABLE contabilidad.movimiento_caja
  ADD COLUMN IF NOT EXISTS id_movimiento_kardex BIGINT
    REFERENCES contabilidad.movimiento_kardex(id) ON DELETE RESTRICT;
