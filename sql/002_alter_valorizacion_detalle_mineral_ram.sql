-- Agrega el soporte de pricing por escala (RAM cargas) a
-- comercio_interno.valorizacion_detalle_mineral, que hasta ahora solo
-- soportaba pricing por cotización (plata). Las columnas nuevas quedan
-- NULL: una fila usa el set de cotización (id_cotizacion_mineral,
-- porcentaje_cotizacion, cotizacion_aplicada) o el set de escala
-- (id_escala_precio, ajuste_puntos_ley, ley_ajustada, precio_usd_tm),
-- nunca ambos.

ALTER TABLE comercio_interno.valorizacion_detalle_mineral
    ADD COLUMN id_escala_precio    INT4 NULL,
    ADD COLUMN ajuste_puntos_ley   NUMERIC(8, 4) NULL,
    ADD COLUMN ley_ajustada        NUMERIC(8, 4) NULL,
    ADD COLUMN precio_usd_tm       NUMERIC(14, 5) NULL;

ALTER TABLE comercio_interno.valorizacion_detalle_mineral
    ADD CONSTRAINT fk_vdm_escala_precio_mineral
    FOREIGN KEY (id_escala_precio)
    REFERENCES parametrica.escala_precio_mineral (id);

CREATE INDEX idx_vdm_escala_precio
    ON comercio_interno.valorizacion_detalle_mineral USING btree (id_escala_precio);
