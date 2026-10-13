-- El recibo pasa a tener tres estados:
--   BORRADOR  -> solo la cabecera (tipo, fecha, monto_total, concepto,
--                contraparte...). Alcanza para imprimir el recibo. Todavía
--                no tiene detalles ni generó ningún movimiento de kardex/caja.
--                Se puede ANULAR desde acá.
--   PROCESADO -> ya tiene recibo_detalle cargado y sus movimientos de
--                kardex/caja generados. Es terminal: no se puede volver a
--                procesar ni anular.
--   ANULADO   -> un BORRADOR que se dio de baja antes de procesarse. También
--                terminal.
-- Un recibo puede crearse directamente PROCESADO (todo en un paso, si ya se
-- manda `detalles` al crear) o como BORRADOR y procesarse después
-- (PATCH /contabilidad/recibo/:id/procesar).

ALTER TABLE contabilidad.recibo
  ADD COLUMN IF NOT EXISTS estado VARCHAR(10) NOT NULL DEFAULT 'PROCESADO';

ALTER TABLE contabilidad.recibo
  ADD CONSTRAINT ck_recibo_estado CHECK (estado IN ('BORRADOR', 'PROCESADO', 'ANULADO'));
