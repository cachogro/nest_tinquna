-- Codificación del lote (promedio de minerales). Catálogo en el esquema parametrica.
-- Si ya se ejecutó en comercio_interno: ALTER TABLE comercio_interno.codificacion_lote SET SCHEMA parametrica;
--
-- Catálogo de tipos de codificación de lote. Cada tipo lleva su PROPIO
-- correlativo (ultimo_correlativo), que el servicio incrementa de forma atómica
-- al crear un promedio. El promedio referencia el tipo por id, así el código o
-- el nombre pueden cambiar sin romper la relación.
--
--   MC = EXPORTACION | TM = LEGAL | C = CARGAS LEGAL | RV = ILEGAL

CREATE TABLE IF NOT EXISTS parametrica.codificacion_lote (
    id                           BIGSERIAL PRIMARY KEY,
    codigo                       VARCHAR(10) NOT NULL,
    nombre                       VARCHAR(100) NOT NULL,
    ultimo_correlativo           BIGINT NOT NULL DEFAULT 0,

    activo                       BOOLEAN NOT NULL DEFAULT TRUE,
    usuario_registro             VARCHAR(100) NOT NULL,
    usuario_ultima_modificacion  VARCHAR(100),
    fecha_registro               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_ultima_modificacion    TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT uq_codificacion_lote_codigo UNIQUE (codigo)
);

INSERT INTO parametrica.codificacion_lote (codigo, nombre, usuario_registro)
VALUES
    ('MC', 'EXPORTACION',  'sistema'),
    ('TM', 'LEGAL',        'sistema'),
    ('C',  'CARGAS LEGAL', 'sistema'),
    ('RV', 'ILEGAL',       'sistema')
ON CONFLICT (codigo) DO NOTHING;

ALTER TABLE comercio_interno.promedio_mineral
    ADD COLUMN IF NOT EXISTS id_codificacion_lote BIGINT NULL
        REFERENCES parametrica.codificacion_lote (id) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS correlativo_lote     BIGINT NULL,
    ADD COLUMN IF NOT EXISTS codigo_lote          VARCHAR(30) NULL;   -- MC-0001 (snapshot)

-- Un correlativo no se repite dentro de la misma codificación.
CREATE UNIQUE INDEX IF NOT EXISTS uq_promedio_mineral_lote_correlativo
    ON comercio_interno.promedio_mineral (id_codificacion_lote, correlativo_lote)
    WHERE id_codificacion_lote IS NOT NULL;
