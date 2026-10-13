-- contabilidad.recibo: dos campos nuevos —
--   fecha_hora_generacion: fecha Y hora reales en que se generó el recibo
--     (a diferencia de `fecha`, que es la fecha contable elegida por el
--     usuario y no lleva hora). La pone siempre el servidor.
--   fecha_primera_impresion: fecha y hora de la PRIMERA vez que se pidió el
--     PDF del recibo (por /pdf o /pdf-procesado). NULL hasta la primera
--     impresión; impresiones posteriores no la modifican.

ALTER TABLE contabilidad.recibo
  ADD COLUMN IF NOT EXISTS fecha_hora_generacion TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fecha_primera_impresion TIMESTAMPTZ;

-- Backfill de recibos ya existentes: usa fecha_registro (auditoría) como
-- mejor aproximación real a cuándo se generó cada uno.
UPDATE contabilidad.recibo
SET fecha_hora_generacion = fecha_registro
WHERE fecha_hora_generacion IS NULL;

ALTER TABLE contabilidad.recibo
  ALTER COLUMN fecha_hora_generacion SET NOT NULL;
