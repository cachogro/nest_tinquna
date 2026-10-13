-- Agrega el peso bruto seco a comercio_interno.valorizacion_mineral.
-- Solo lo usan codificaciones que descuentan humedad antes de la merma
-- (ej. BCL: PSB = PHB - H2O). En las demás codificaciones queda NULL.

ALTER TABLE comercio_interno.valorizacion_mineral
    ADD COLUMN peso_bruto_seco_kilogramos NUMERIC(15, 5) NULL;
