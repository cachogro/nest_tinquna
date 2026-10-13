-- Tabla: parametrica.escala_precio_mineral
-- Escala de precio por tramo de ley (Zn, Ag, Pb...), independiente de
-- parametrica.cotizacion_mineral. Cada fila es un tramo (mineral + ley)
-- versionado por vigencia (fecha_vigencia_inicial / fecha_vigencia_final,
-- mismo naming que cotizacion_mineral); precio_tm y las fechas de vigencia
-- los envía el front al crear o actualizar un tramo.

CREATE TABLE parametrica.escala_precio_mineral (
    id                   SERIAL PRIMARY KEY,

    id_mineral           BIGINT NOT NULL
                         REFERENCES parametrica.mineral (id)
                         ON DELETE RESTRICT,

    ley                  NUMERIC NOT NULL,

    precio_punto         NUMERIC NOT NULL,   -- $US/PTO
    precio_tm            NUMERIC NOT NULL,   -- $US/TM

    fecha_vigencia_inicial   TIMESTAMPTZ NOT NULL,
    fecha_vigencia_final     TIMESTAMPTZ,        -- NULL = vigente indefinidamente

    -- columnas de auditoría (mismo patrón que el resto del esquema)
    activo                       BOOLEAN NOT NULL DEFAULT TRUE,
    usuario_registro             VARCHAR(100) NOT NULL,
    usuario_ultima_modificacion  VARCHAR(100),
    fecha_registro                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_ultima_modificacion     TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT ck_epm_precio_punto_positivo CHECK (precio_punto >= 0),
    CONSTRAINT ck_epm_precio_tm_positivo CHECK (precio_tm >= 0),
    CONSTRAINT ck_epm_ley_positiva CHECK (ley >= 0),
    CONSTRAINT ck_epm_vigencia_valida CHECK (fecha_vigencia_final IS NULL OR fecha_vigencia_final > fecha_vigencia_inicial)
);

-- Nunca dos precios "vigentes" (activos, sin fecha de cierre) a la vez para el mismo (mineral, ley).
-- Incluye "activo" porque una carga nueva que se solapa con una vieja no la borra: la desactiva.
CREATE UNIQUE INDEX uq_epm_vigente
    ON parametrica.escala_precio_mineral (id_mineral, ley)
    WHERE fecha_vigencia_final IS NULL AND activo = TRUE;

-- Búsqueda de tramo por ley (LOOKUP: el mayor ley <= valor buscado)
CREATE INDEX idx_epm_mineral_ley
    ON parametrica.escala_precio_mineral (id_mineral, ley DESC);
