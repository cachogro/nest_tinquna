-- contabilidad.venta_lote: monto estimado de la valorización.
--
-- Es lo que la empresa calcula que vale el lote ANTES de que el comprador
-- mande su liquidación (monto_venta). Sirve solo para comparar lo estimado
-- contra lo que liquida el comprador: no genera movimientos en kardex, caja
-- ni banco. Va en la moneda de la venta (BS o USD), igual que monto_venta.
-- NULL = todavía no se estimó.

ALTER TABLE contabilidad.venta_lote
    ADD COLUMN IF NOT EXISTS monto_estimado NUMERIC(16, 2);

ALTER TABLE contabilidad.venta_lote
    DROP CONSTRAINT IF EXISTS ck_venta_lote_monto_estimado;
ALTER TABLE contabilidad.venta_lote
    ADD CONSTRAINT ck_venta_lote_monto_estimado CHECK (
        monto_estimado IS NULL OR monto_estimado > 0
    );
