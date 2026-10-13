-- Agrega el control de "entregado" a comercio_interno.valorizacion_mineral.
--
-- entregado = true indica que el material de esta valorización ya salió del
-- ingenio. Solo puede activarse cuando la valorización está en estado
-- PRE-VALORIZADO (2) o VALORIZADO (3). Se gestiona con el endpoint dedicado
-- PATCH /comercio_interno/valorizacion_mineral/:id/entregado (pensado para un
-- botón de alternado en el front), no con el PATCH genérico de la valorización.
--
-- fecha_entregado guarda el momento en que se marcó la salida del material;
-- queda NULL mientras entregado sea false.

ALTER TABLE comercio_interno.valorizacion_mineral
    ADD COLUMN entregado BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE comercio_interno.valorizacion_mineral
    ADD COLUMN fecha_entregado TIMESTAMPTZ NULL;
