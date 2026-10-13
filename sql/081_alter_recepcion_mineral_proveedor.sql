-- comercio_interno.recepcion_mineral: proveedor como persona, actor o externo.
--
-- Por nuevo requerimiento quien deja el mineral puede ser:
--   · una persona registrada (id_persona), incluido el personal interno;
--   · un actor productivo minero (id_actor_productivo_minero);
--   · un externo del que solo se conoce nombre y apellido (nombres_apellidos).
--
-- La recepción ya no decide a qué kardex va el dinero: eso se elige al
-- procesar el recibo (anticipo de la recepción o pago de la valorización).
--
-- nombres_apellidos guarda el nombre del proveedor tal como se registró
-- (también para persona y actor), para listados y PDFs. En las recepciones
-- anteriores queda null y se sigue leyendo de la persona.

ALTER TABLE comercio_interno.recepcion_mineral
    ALTER COLUMN id_persona DROP NOT NULL;

ALTER TABLE comercio_interno.recepcion_mineral
    ADD COLUMN IF NOT EXISTS id_actor_productivo_minero BIGINT;

ALTER TABLE comercio_interno.recepcion_mineral
    ADD COLUMN IF NOT EXISTS nombres_apellidos VARCHAR(255);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_recepcion_mineral_actor_productivo_minero'
    ) THEN
        ALTER TABLE comercio_interno.recepcion_mineral
            ADD CONSTRAINT fk_recepcion_mineral_actor_productivo_minero
            FOREIGN KEY (id_actor_productivo_minero)
            REFERENCES parametrica.actor_productivo_minero (id)
            ON DELETE RESTRICT;
    END IF;

    -- A lo sumo una contraparte registrada, y siempre alguna forma de
    -- identificar al proveedor.
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ck_recepcion_mineral_proveedor'
    ) THEN
        ALTER TABLE comercio_interno.recepcion_mineral
            ADD CONSTRAINT ck_recepcion_mineral_proveedor
            CHECK (
                num_nonnulls(id_persona, id_actor_productivo_minero) <= 1
                AND (
                    id_persona IS NOT NULL
                    OR id_actor_productivo_minero IS NOT NULL
                    OR NULLIF(BTRIM(nombres_apellidos), '') IS NOT NULL
                )
            );
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_recepcion_mineral_actor_productivo_minero
    ON comercio_interno.recepcion_mineral (id_actor_productivo_minero);
