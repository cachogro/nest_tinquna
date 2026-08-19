-- Ajustes en comercio_interno.valorizacion_mineral:
-- 1. liquido_pagable_bolivianos guardaba el mismo dato que
--    total_valor_bruto_bolivianos, se elimina la columna duplicada.
-- 2. saldo_pagar_bolivianos se renombra a total_valor_liquido_venta_bolivianos.
-- 3. Se agrega total_valor_liquido_venta_usd.

ALTER TABLE comercio_interno.valorizacion_mineral
    DROP COLUMN liquido_pagable_bolivianos;

ALTER TABLE comercio_interno.valorizacion_mineral
    RENAME COLUMN saldo_pagar_bolivianos TO total_valor_liquido_venta_bolivianos;

ALTER TABLE comercio_interno.valorizacion_mineral
    ADD COLUMN total_valor_liquido_venta_usd NUMERIC(14, 2) NULL;
