-- La columna nro_comprobante venía usándose para dos cosas distintas del
-- Excel ("FACTURA Y/O RECIBO" y "Nº CPTE" mezclados). Se separan:
--   factura_recibo -> si el respaldo es un recibo, su código (ej.
--                     "REC:C-0933"); si es una factura, su número.
--   nro_comprobante -> el número de comprobante real de la transacción
--                     (ej. n° de transferencia/QR), independiente del
--                     recibo/factura que lo respalda.

ALTER TABLE contabilidad.movimiento_caja
  ADD COLUMN IF NOT EXISTS factura_recibo VARCHAR(30);
