-- Unifica el código de moneda en todo el proyecto: 'BS' (bolivianos) y
-- 'USD'. Hasta ahora parametrica.cuenta_bancaria usaba 'BS' (ver
-- 044_alter_cuenta_bancaria_moneda_bs.sql) pero la caja, el traspaso, el
-- recibo y el kardex usaban 'BOB' para lo mismo, y había que traducir.
--
--   - Datos: 'BOB' -> 'BS' en periodo_caja, movimiento_caja, traspaso,
--     recibo y movimiento_kardex.
--   - CHECK y DEFAULT de esas tablas pasan a ('BS', 'USD').
--   - parametrica.caja: saldo_inicial_bob / fecha_saldo_inicial_bob ->
--     saldo_inicial_bs / fecha_saldo_inicial_bs.
--
-- Idempotente: se puede correr aunque 067 ya se haya aplicado con 'BOB'.

BEGIN;

-- periodo_caja ------------------------------------------------------------
ALTER TABLE contabilidad.periodo_caja DROP CONSTRAINT IF EXISTS ck_periodo_caja_moneda;
UPDATE contabilidad.periodo_caja SET moneda = 'BS' WHERE moneda = 'BOB';
ALTER TABLE contabilidad.periodo_caja
    ADD CONSTRAINT ck_periodo_caja_moneda CHECK (moneda IN ('BS', 'USD'));

-- movimiento_caja ---------------------------------------------------------
ALTER TABLE contabilidad.movimiento_caja DROP CONSTRAINT IF EXISTS ck_movimiento_caja_moneda;
UPDATE contabilidad.movimiento_caja SET moneda = 'BS' WHERE moneda = 'BOB';
ALTER TABLE contabilidad.movimiento_caja
    ADD CONSTRAINT ck_movimiento_caja_moneda CHECK (moneda IN ('BS', 'USD'));

-- traspaso ----------------------------------------------------------------
ALTER TABLE contabilidad.traspaso DROP CONSTRAINT IF EXISTS ck_traspaso_moneda;
UPDATE contabilidad.traspaso SET moneda = 'BS' WHERE moneda = 'BOB';
ALTER TABLE contabilidad.traspaso
    ADD CONSTRAINT ck_traspaso_moneda CHECK (moneda IN ('BS', 'USD'));

-- recibo ------------------------------------------------------------------
ALTER TABLE contabilidad.recibo DROP CONSTRAINT IF EXISTS chk_recibo_moneda;
UPDATE contabilidad.recibo SET moneda = 'BS' WHERE moneda = 'BOB';
ALTER TABLE contabilidad.recibo ALTER COLUMN moneda SET DEFAULT 'BS';
ALTER TABLE contabilidad.recibo
    ADD CONSTRAINT chk_recibo_moneda CHECK (
        moneda IN ('BS', 'USD')
        AND (moneda = 'BS' OR tipo_cambio > 0)
    );

-- movimiento_kardex -------------------------------------------------------
ALTER TABLE contabilidad.movimiento_kardex DROP CONSTRAINT IF EXISTS chk_movimiento_kardex_moneda;
UPDATE contabilidad.movimiento_kardex SET moneda = 'BS' WHERE moneda = 'BOB';
ALTER TABLE contabilidad.movimiento_kardex ALTER COLUMN moneda SET DEFAULT 'BS';
ALTER TABLE contabilidad.movimiento_kardex
    ADD CONSTRAINT chk_movimiento_kardex_moneda CHECK (
        moneda IN ('BS', 'USD')
        AND (moneda = 'BS' OR tipo_cambio > 0)
    );

-- parametrica.caja: columnas del saldo de apertura en bolivianos ----------
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'parametrica' AND table_name = 'caja'
          AND column_name = 'saldo_inicial_bob'
    ) THEN
        ALTER TABLE parametrica.caja RENAME COLUMN saldo_inicial_bob TO saldo_inicial_bs;
    END IF;
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'parametrica' AND table_name = 'caja'
          AND column_name = 'fecha_saldo_inicial_bob'
    ) THEN
        ALTER TABLE parametrica.caja RENAME COLUMN fecha_saldo_inicial_bob TO fecha_saldo_inicial_bs;
    END IF;
END $$;

COMMIT;
