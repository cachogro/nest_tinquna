-- Boleta de pago: fecha Y hora reales en que se emitió (todos los recibos,
-- boletas y comprobantes se imprimen con fecha y hora). Igual que
-- recibo.fecha_hora_generacion (ver 054_alter_recibo_fecha_hora_generacion_impresion.sql):
-- fecha_pago es solo la fecha contable, sin hora.

ALTER TABLE contabilidad.boleta_pago
  ADD COLUMN IF NOT EXISTS fecha_hora_generacion TIMESTAMPTZ;

UPDATE contabilidad.boleta_pago
SET fecha_hora_generacion = fecha_registro
WHERE fecha_hora_generacion IS NULL;

ALTER TABLE contabilidad.boleta_pago
  ALTER COLUMN fecha_hora_generacion SET DEFAULT NOW(),
  ALTER COLUMN fecha_hora_generacion SET NOT NULL;
