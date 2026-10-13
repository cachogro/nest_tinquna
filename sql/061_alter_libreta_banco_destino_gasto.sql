-- contabilidad.libreta_banco: agrega el destino del gasto / categoría del
-- ingreso (parametrica.destino_gasto), igual que ya tienen movimiento_caja,
-- movimiento_kardex, recibo_detalle y (desde 060) traspaso.
--
-- Hacía falta porque, tras separar caja/banco según el medio de pago (un
-- recibo o movimiento de kardex pagado por banco ya NO genera fila en
-- movimiento_caja), el destino del gasto de esas líneas se quedaba sin
-- ningún lugar en la libreta de bancos: quedaba "invisible" para cualquier
-- reporte por destino que solo mirara movimiento_caja. También prepara el
-- terreno para las columnas de banco de la hoja "CAJA DE FLUJO" del Excel
-- (hoy solo implementadas para efectivo, ver CajaFlujoExcelService).

ALTER TABLE contabilidad.libreta_banco
    ADD COLUMN IF NOT EXISTS id_destino_gasto INTEGER
        REFERENCES parametrica.destino_gasto (id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_libreta_banco_destino_gasto
    ON contabilidad.libreta_banco (id_destino_gasto);
