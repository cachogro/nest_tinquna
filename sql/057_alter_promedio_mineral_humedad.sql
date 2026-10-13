-- Humedad en el promedio de minerales:
--  * promedio_mineral.humedad_promedio_porcentaje: humedad promedio ponderada por peso.
--  * promedio_mineral_detalle.humedad_porcentaje: humedad de la valorización al entrar al promedio (snapshot).
ALTER TABLE comercio_interno.promedio_mineral
    ADD COLUMN IF NOT EXISTS humedad_promedio_porcentaje NUMERIC(12,5) NULL;

ALTER TABLE comercio_interno.promedio_mineral_detalle
    ADD COLUMN IF NOT EXISTS humedad_porcentaje NUMERIC(12,5) NULL;
