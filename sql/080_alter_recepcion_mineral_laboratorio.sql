-- comercio_interno.recepcion_mineral: laboratorio de la recepción.
--
-- Por nuevo requerimiento el laboratorio también se registra en la recepción
-- de mineral (antes solo en la valorización). No es obligatorio.
--
-- null = la recepción no tiene laboratorio asignado.
-- Al crear el borrador de la valorización se copia a
-- valorizacion_mineral.id_laboratorio; desde ahí cada uno se edita por
-- separado (cambiarlo en la valorización no modifica la recepción).

ALTER TABLE comercio_interno.recepcion_mineral
    ADD COLUMN IF NOT EXISTS id_laboratorio BIGINT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_recepcion_mineral_laboratorio'
    ) THEN
        ALTER TABLE comercio_interno.recepcion_mineral
            ADD CONSTRAINT fk_recepcion_mineral_laboratorio
            FOREIGN KEY (id_laboratorio)
            REFERENCES parametrica.laboratorio (id)
            ON DELETE RESTRICT;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_recepcion_mineral_laboratorio
    ON comercio_interno.recepcion_mineral (id_laboratorio);
