-- contabilidad.traspaso: tipo de cambio (Bs. por 1 USD) de los traspasos en
-- dólares, mismo criterio que recibo.tipo_cambio (ver
-- 067_alter_recibo_kardex_moneda_usd.sql). El traspaso sigue moviendo USD en
-- ambos lados (caja en USD <-> cuenta bancaria en USD): el tipo de cambio
-- queda registrado como referencia del equivalente en Bs., no convierte
-- ningún saldo.
--
-- Nullable y sin CHECK contra la moneda para no romper los traspasos en USD
-- ya registrados sin este dato; TraspasoService lo exige en todo traspaso en
-- USD nuevo o editado, y lo deja en null en los de Bs.

ALTER TABLE contabilidad.traspaso
    ADD COLUMN IF NOT EXISTS tipo_cambio NUMERIC(12, 4);

ALTER TABLE contabilidad.traspaso
    DROP CONSTRAINT IF EXISTS ck_traspaso_tipo_cambio;
ALTER TABLE contabilidad.traspaso
    ADD CONSTRAINT ck_traspaso_tipo_cambio CHECK (
        tipo_cambio IS NULL OR tipo_cambio > 0
    );
