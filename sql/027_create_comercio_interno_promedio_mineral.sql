-- Promedios de mineral (hoja PROMEDIOS.xlsx).
--
-- Un promedio agrupa varias valorizaciones (PRE-VALORIZADO o VALORIZADO),
-- elegidas a conveniencia, y calcula la ley promedio PONDERADA POR PESO de
-- cada mineral:  SUM(ley * peso) / SUM(peso)   (igual que el SUMPRODUCT del Excel).
--
--   promedio_mineral          cabecera, con código propio PRM-0001 y las leyes
--                             promedio por mineral en la columna JSONB `leyes`
--   promedio_mineral_detalle  valorizaciones que lo conforman (snapshot de peso/sacos)
--
-- Bandera: valorizacion_mineral.id_promedio_mineral.
--   NULL     -> disponible para seleccionar
--   NOT NULL -> ya forma parte de un promedio; no puede elegirse de nuevo
-- Al anular el promedio (activo = false) el servicio pone la bandera en NULL.

CREATE SEQUENCE IF NOT EXISTS comercio_interno.seq_promedio_mineral START 1;

CREATE TABLE IF NOT EXISTS comercio_interno.promedio_mineral (
    id                           BIGSERIAL PRIMARY KEY,
    uuid                         UUID NOT NULL,
    correlativo                  BIGINT NOT NULL,
    codigo                       VARCHAR(20) NOT NULL,      -- PRM-0001
    descripcion                  VARCHAR(150),
    fecha                        DATE NOT NULL DEFAULT CURRENT_DATE,
    cantidad_valorizaciones      INTEGER NOT NULL DEFAULT 0,
    numero_sacos_total           INTEGER NOT NULL DEFAULT 0,
    peso_total_kilogramos        NUMERIC(15,5) NOT NULL DEFAULT 0,
    -- TOTAL DE EFECTIVO INVERTIDO: suma del valor neto de venta (Bs) de las
    -- valorizaciones del promedio, fijada al crear/editar la composición.
    total_efectivo_invertido     NUMERIC(15,2) NOT NULL DEFAULT 0,
    -- [{idMineral, mineral, leyPromedio, leyUnidad, pesoBaseKilogramos}]
    leyes                        JSONB NOT NULL DEFAULT '[]'::jsonb,
    observaciones                VARCHAR(255),

    activo                       BOOLEAN NOT NULL DEFAULT TRUE,
    usuario_registro             VARCHAR(100) NOT NULL,
    usuario_ultima_modificacion  VARCHAR(100),
    fecha_registro               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_ultima_modificacion    TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT uq_promedio_mineral_codigo UNIQUE (codigo),
    CONSTRAINT uq_promedio_mineral_correlativo UNIQUE (correlativo)
);

CREATE TABLE IF NOT EXISTS comercio_interno.promedio_mineral_detalle (
    id                           BIGSERIAL PRIMARY KEY,
    id_promedio_mineral          BIGINT NOT NULL
                                 REFERENCES comercio_interno.promedio_mineral (id)
                                 ON DELETE CASCADE,
    id_valorizacion              BIGINT NOT NULL
                                 REFERENCES comercio_interno.valorizacion_mineral (id)
                                 ON DELETE RESTRICT,
    numero_sacos                 INTEGER,
    peso_kilogramos              NUMERIC(15,5) NOT NULL,
    -- total_valor_neto_venta_bolivianos de la valorización al entrar al promedio.
    valor_neto_venta_bolivianos  NUMERIC(15,2) NOT NULL DEFAULT 0,

    activo                       BOOLEAN NOT NULL DEFAULT TRUE,
    usuario_registro             VARCHAR(100) NOT NULL,
    usuario_ultima_modificacion  VARCHAR(100),
    fecha_registro               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_ultima_modificacion    TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT uq_promedio_detalle UNIQUE (id_promedio_mineral, id_valorizacion)
);

CREATE INDEX IF NOT EXISTS idx_promedio_detalle_valorizacion
    ON comercio_interno.promedio_mineral_detalle (id_valorizacion);

-- Bandera en la valorización.
ALTER TABLE comercio_interno.valorizacion_mineral
    ADD COLUMN IF NOT EXISTS id_promedio_mineral BIGINT NULL
    REFERENCES comercio_interno.promedio_mineral (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_valorizacion_promedio
    ON comercio_interno.valorizacion_mineral (id_promedio_mineral);

-- Por si las tablas ya se habían creado con una versión anterior de este script.
ALTER TABLE comercio_interno.promedio_mineral
    ADD COLUMN IF NOT EXISTS total_efectivo_invertido NUMERIC(15,2) NOT NULL DEFAULT 0;
ALTER TABLE comercio_interno.promedio_mineral_detalle
    ADD COLUMN IF NOT EXISTS valor_neto_venta_bolivianos NUMERIC(15,2) NOT NULL DEFAULT 0;
