-- contabilidad.libreta_banco: tipo de cambio (Bs. por 1 USD) de los
-- movimientos de cuentas en dólares. La libreta sigue llevando debe / haber /
-- saldo en la moneda de la cuenta: el tipo de cambio queda como referencia
-- del equivalente en Bs. y es el que usa la línea de kardex cuando el
-- movimiento tiene persona / actor / cliente (el kardex va siempre en Bs.).
--
-- Nullable y sin CHECK contra la moneda: los movimientos en USD ya
-- registrados, y los que nacen de un recibo o de una línea de kardex, no lo
-- traen. LibretaBancoService lo exige en todo movimiento MANUAL de una
-- cuenta en USD (nuevo o editado) y lo deja en null en las cuentas en Bs.

ALTER TABLE contabilidad.libreta_banco
    ADD COLUMN IF NOT EXISTS tipo_cambio NUMERIC(12, 4);

ALTER TABLE contabilidad.libreta_banco
    DROP CONSTRAINT IF EXISTS ck_libreta_banco_tipo_cambio;
ALTER TABLE contabilidad.libreta_banco
    ADD CONSTRAINT ck_libreta_banco_tipo_cambio CHECK (
        tipo_cambio IS NULL OR tipo_cambio > 0
    );
