-- =============================================================================
-- Caja de flujo: N° de comprobante y factura/recibo pasan de 30 a 100
-- caracteres. Un mismo pago puede respaldarse con varios depósitos (ej. las
-- retenciones "DEP:CNS-80642881, FEDECOMIN-3574352121332070912,
-- FENCOMIN-6P06064718"), que no entran en 30.
-- Solo movimiento_caja: kardex, libreta y recibo siguen en 30.
-- =============================================================================

ALTER TABLE contabilidad.movimiento_caja
  ALTER COLUMN nro_comprobante TYPE varchar(100),
  ALTER COLUMN factura_recibo TYPE varchar(100);
