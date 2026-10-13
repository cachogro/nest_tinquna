-- contabilidad.libreta_banco: separa el n° de transacción bancaria del
-- código del recibo/factura que respalda el movimiento (mismo patrón que
-- movimiento_caja.factura_recibo y movimiento_kardex.factura_recibo).
-- Antes, cuando el movimiento venía de un recibo, `nro_transaccion` guardaba
-- el n° de comprobante externo (si existía) o si no el código del recibo,
-- perdiendo ese código apenas el recibo tenía un n° de comprobante externo.

ALTER TABLE contabilidad.libreta_banco
    ADD COLUMN IF NOT EXISTS factura_recibo VARCHAR(30);

-- Backfill: movimientos que vienen directo de un recibo procesado.
UPDATE contabilidad.libreta_banco lb
    SET factura_recibo = 'REC:' || r.serie || '-' || LPAD(r.numero::text, 4, '0')
    FROM contabilidad.recibo r
    WHERE lb.id_recibo = r.id
      AND lb.factura_recibo IS NULL;

-- Backfill: movimientos que vienen de un movimiento de kardex (pago directo,
-- no vía recibo) que ya tenía su propio factura_recibo cargado.
UPDATE contabilidad.libreta_banco lb
    SET factura_recibo = mk.factura_recibo
    FROM contabilidad.movimiento_kardex mk
    WHERE lb.id_movimiento_kardex = mk.id
      AND lb.factura_recibo IS NULL
      AND mk.factura_recibo IS NOT NULL;

-- Los `nro_transaccion` que en realidad guardaban el código del recibo (por
-- no tener comprobante externo) quedan duplicados en factura_recibo por el
-- backfill de arriba; se limpian para que nro_transaccion vuelva a ser
-- exclusivamente el n° de transacción bancaria real.
UPDATE contabilidad.libreta_banco
    SET nro_transaccion = NULL
    WHERE nro_transaccion = factura_recibo;
