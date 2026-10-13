-- =============================================================================
-- Caja de flujo y libreta de bancos: el folio es único POR GESTIÓN.
-- El servicio numera el folio dentro de la gestión (reinicia en 1 cada año,
-- ver siguienteFolio), pero el índice único era global: el primer movimiento
-- de otra gestión (uno con fecha de un año anterior, o el primero de enero)
-- tomaba el folio 1 y chocaba con el folio 1 ya existente (error 500).
-- La gestión del folio es siempre el año de la fecha del movimiento.
-- =============================================================================

DROP INDEX IF EXISTS contabilidad.uq_movimiento_caja_folio;
CREATE UNIQUE INDEX IF NOT EXISTS uq_movimiento_caja_folio
    ON contabilidad.movimiento_caja (id_caja, moneda, (EXTRACT(YEAR FROM fecha)), folio)
    WHERE folio IS NOT NULL;

DROP INDEX IF EXISTS contabilidad.uq_libreta_banco_folio;
CREATE UNIQUE INDEX IF NOT EXISTS uq_libreta_banco_folio
    ON contabilidad.libreta_banco (id_cuenta_bancaria, (EXTRACT(YEAR FROM fecha)), folio)
    WHERE folio IS NOT NULL;
