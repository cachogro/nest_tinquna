-- movimiento_kardex: lote de mineral asociado al movimiento (texto libre
-- por ahora, sin catálogo ni FK). Pensado principalmente para kardex de
-- CLIENTE (qué lote se entregó/cobró), pero queda disponible para
-- cualquier tipo de kardex.

ALTER TABLE contabilidad.movimiento_kardex
  ADD COLUMN IF NOT EXISTS lote VARCHAR(100);
