-- comercio_interno.valorizacion_mineral: codificación con la que se valoriza.
--
-- La recepción nace con una codificación (ej. ICC) que define su código de
-- operación y su correlativo. Si el análisis de laboratorio muestra que
-- conviene valorizar con otra (ej. más plomo y poca plata -> BCL), se
-- registra aquí, sin tocar la recepción ni generar un correlativo nuevo.
--
-- null = se valoriza con la codificación de la recepción.
-- La codificación efectiva (promedios, formato del PDF, reportes de
-- valorización) es COALESCE(valorizacion.id_codificacion_valorizacion,
-- recepcion.id_codificacion).

ALTER TABLE comercio_interno.valorizacion_mineral
    ADD COLUMN IF NOT EXISTS id_codificacion_valorizacion BIGINT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_valorizacion_mineral_codificacion_valorizacion'
    ) THEN
        ALTER TABLE comercio_interno.valorizacion_mineral
            ADD CONSTRAINT fk_valorizacion_mineral_codificacion_valorizacion
            FOREIGN KEY (id_codificacion_valorizacion)
            REFERENCES parametrica.codificacion (id)
            ON DELETE RESTRICT;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_valorizacion_mineral_codificacion_valorizacion
    ON comercio_interno.valorizacion_mineral (id_codificacion_valorizacion);
