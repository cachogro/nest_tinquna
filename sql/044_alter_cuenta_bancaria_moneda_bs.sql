-- Corrige el código de moneda nacional en parametrica.cuenta_bancaria:
-- se usaba 'BOB' (código ISO), pero el código correcto para este catálogo
-- es 'BS' (moneda nacional). 'USD' (dólares) se mantiene igual.

ALTER TABLE parametrica.cuenta_bancaria
    DROP CONSTRAINT IF EXISTS ck_cuenta_bancaria_moneda;

UPDATE parametrica.cuenta_bancaria
    SET moneda = 'BS'
    WHERE moneda = 'BOB';

ALTER TABLE parametrica.cuenta_bancaria
    ALTER COLUMN moneda SET DEFAULT 'BS';

ALTER TABLE parametrica.cuenta_bancaria
    ADD CONSTRAINT ck_cuenta_bancaria_moneda CHECK (moneda IN ('BS', 'USD'));
