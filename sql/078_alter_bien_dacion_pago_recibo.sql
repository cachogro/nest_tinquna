-- contabilidad.bien_dacion_pago: al VENDER el bien, el monto amortiza la deuda
-- del dueño original. La venta genera un recibo de INGRESO (PROCESADO) con una
-- línea PERSONAL/ACTOR: HABER en su kardex y entrada a la caja de flujo (o a la
-- libreta bancaria si se cobró por un medio bancario). Se guarda el vínculo al
-- recibo y a la línea del kardex. NULL en los bienes vendidos antes de esto.

ALTER TABLE contabilidad.bien_dacion_pago
  ADD COLUMN IF NOT EXISTS id_recibo BIGINT
      REFERENCES contabilidad.recibo (id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS id_movimiento_kardex BIGINT
      REFERENCES contabilidad.movimiento_kardex (id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_bien_dacion_pago_recibo
    ON contabilidad.bien_dacion_pago (id_recibo);
