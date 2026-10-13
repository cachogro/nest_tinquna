-- contabilidad.traspaso: agrega el destino del gasto / categoría del
-- ingreso (parametrica.destino_gasto), igual que ya tienen movimiento_caja,
-- movimiento_kardex y recibo_detalle. Se refleja en el movimiento de la
-- caja de flujo que genera el traspaso; la libreta de bancos no tiene esta
-- columna.
--
-- Nota contable: el reporte "cuánto se gastó/ingresó por destino"
-- (ReporteDestinoGastoService) sigue excluyendo estos movimientos
-- (movimiento_caja.id_traspaso IS NOT NULL) porque un traspaso no es un
-- gasto/ingreso real del negocio; esta columna queda disponible para otros
-- reportes contables que sí quieran clasificar/filtrar los traspasos.

ALTER TABLE contabilidad.traspaso
    ADD COLUMN IF NOT EXISTS id_destino_gasto INTEGER
        REFERENCES parametrica.destino_gasto (id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_traspaso_destino_gasto
    ON contabilidad.traspaso (id_destino_gasto);
