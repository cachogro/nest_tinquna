-- Tabla: parametrica.lugar_acopio
-- Catálogo de lugares donde se recibe el mineral (galpón, ingenio Villa, etc.).
-- Solo alimenta la lista desplegable del front: la recepción de mineral guarda
-- el lugar como texto (comercio_interno.recepcion_mineral.lugar_acopio), sin
-- relación por clave foránea.

CREATE TABLE IF NOT EXISTS parametrica.lugar_acopio (
    id                           SERIAL PRIMARY KEY,
    descripcion                  VARCHAR(100) NOT NULL,

    -- columnas de auditoría (mismo patrón que el resto del esquema)
    activo                       BOOLEAN NOT NULL DEFAULT TRUE,
    usuario_registro             VARCHAR(100) NOT NULL,
    usuario_ultima_modificacion  VARCHAR(100),
    fecha_registro               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_ultima_modificacion    TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_lugar_acopio_descripcion
    ON parametrica.lugar_acopio (UPPER(descripcion));

INSERT INTO parametrica.lugar_acopio (descripcion, usuario_registro) VALUES
    ('GALPON',         'sistema'),
    ('INGENIO VILLA',  'sistema')
ON CONFLICT DO NOTHING;

-- Texto libre del lugar donde se recibió el mineral (sin relación).
ALTER TABLE comercio_interno.recepcion_mineral
    ADD COLUMN IF NOT EXISTS lugar_acopio VARCHAR(100) NULL;
