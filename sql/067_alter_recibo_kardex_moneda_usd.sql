-- Recibos y movimientos de kardex en dólares (remesas por exportación de
-- minerales). La moneda base del kardex sigue siendo el boliviano: `debe`,
-- `haber` y `saldo` quedan SIEMPRE en Bs. (convertidos con el tipo de
-- cambio), y la línea guarda además su moneda de origen, el tipo de cambio
-- usado y los importes originales en USD (`debe_usd` / `haber_usd`).
--
-- contabilidad.recibo: `monto_total` y `recibo_detalle.monto` quedan en la
-- moneda del recibo; la caja de flujo / libreta de bancos reciben el monto
-- en esa misma moneda (caja en USD, o cuenta bancaria en USD).
--
-- Todo lo existente queda como BS sin tipo de cambio.

BEGIN;

ALTER TABLE contabilidad.recibo
    ADD COLUMN IF NOT EXISTS moneda VARCHAR(3) NOT NULL DEFAULT 'BS',
    ADD COLUMN IF NOT EXISTS tipo_cambio NUMERIC(12, 4);

ALTER TABLE contabilidad.recibo
    DROP CONSTRAINT IF EXISTS chk_recibo_moneda;
ALTER TABLE contabilidad.recibo
    ADD CONSTRAINT chk_recibo_moneda CHECK (
        moneda IN ('BS', 'USD')
        AND (moneda = 'BS' OR tipo_cambio > 0)
    );

ALTER TABLE contabilidad.movimiento_kardex
    ADD COLUMN IF NOT EXISTS moneda VARCHAR(3) NOT NULL DEFAULT 'BS',
    ADD COLUMN IF NOT EXISTS tipo_cambio NUMERIC(12, 4),
    ADD COLUMN IF NOT EXISTS debe_usd NUMERIC(16, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS haber_usd NUMERIC(16, 2) NOT NULL DEFAULT 0;

ALTER TABLE contabilidad.movimiento_kardex
    DROP CONSTRAINT IF EXISTS chk_movimiento_kardex_moneda;
ALTER TABLE contabilidad.movimiento_kardex
    ADD CONSTRAINT chk_movimiento_kardex_moneda CHECK (
        moneda IN ('BS', 'USD')
        AND (moneda = 'BS' OR tipo_cambio > 0)
    );

COMMIT;
