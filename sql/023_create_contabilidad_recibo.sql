-- Tablas: contabilidad.recibo + contabilidad.recibo_detalle
-- Recibo de ingreso (serie R) o egreso (serie C) que se genera y postea
-- automáticamente al kardex de anticipos:
--   * INGRESO: 1 línea HABER en el kardex de quien paga (baja su deuda) +
--     1 línea HABER por el mismo monto en el kardex de la empresa (actor id=1).
--   * EGRESO: el total se puede subdividir entre kardex PERSONAL, kardex de
--     un ACTOR productivo minero, y una porción en EFECTIVO (sin kardex
--     propio); cada porción a kardex va HABER (salda deuda existente); el
--     kardex de la empresa recibe una línea DEBE por el TOTAL del recibo
--     (incluida la porción en efectivo).
-- numero es correlativo GLOBAL por serie: nunca reinicia.

CREATE TABLE IF NOT EXISTS contabilidad.recibo (
    id                             BIGSERIAL PRIMARY KEY,

    tipo                           VARCHAR(10) NOT NULL,   -- INGRESO | EGRESO
    serie                          VARCHAR(1)  NOT NULL,   -- R | C
    numero                         INTEGER NOT NULL,

    fecha                          DATE NOT NULL,
    monto                          NUMERIC(16,2) NOT NULL,
    concepto                       VARCHAR(255) NOT NULL,

    id_forma_pago                  INTEGER
                                   REFERENCES parametrica.forma_pago (id)
                                   ON DELETE RESTRICT,

    -- Contraparte física del recibo ("Recibí de" / "Entregué a").
    id_persona                     BIGINT NOT NULL
                                   REFERENCES comercio_interno.persona_ci (id)
                                   ON DELETE RESTRICT,

    -- Tipo de movimiento de kardex aplicado a TODAS las líneas que genera.
    id_tipo_movimiento             INTEGER
                                   REFERENCES parametrica.tipo_movimiento_kardex (id)
                                   ON DELETE RESTRICT,

    -- Línea espejo generada en el kardex de la empresa (actor id=1).
    id_movimiento_kardex_empresa   BIGINT
                                   REFERENCES contabilidad.movimiento_kardex (id)
                                   ON DELETE RESTRICT,

    -- columnas de auditoría (mismo patrón que el resto de la base)
    activo                         BOOLEAN NOT NULL DEFAULT TRUE,
    usuario_registro               VARCHAR(100) NOT NULL,
    usuario_ultima_modificacion    VARCHAR(100),
    fecha_registro                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_ultima_modificacion      TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT ck_recibo_tipo CHECK (tipo IN ('INGRESO', 'EGRESO')),
    CONSTRAINT ck_recibo_serie CHECK (serie IN ('R', 'C')),
    CONSTRAINT ck_recibo_monto_positivo CHECK (monto > 0),
    CONSTRAINT ck_recibo_tipo_serie CHECK (
        (tipo = 'INGRESO' AND serie = 'R') OR
        (tipo = 'EGRESO'  AND serie = 'C')
    ),
    CONSTRAINT uq_recibo_serie_numero UNIQUE (serie, numero)
);

CREATE INDEX IF NOT EXISTS idx_recibo_persona
    ON contabilidad.recibo (id_persona);
CREATE INDEX IF NOT EXISTS idx_recibo_fecha
    ON contabilidad.recibo (fecha);

-- Líneas de aplicación de un recibo: a qué kardex (o efectivo directo) se
-- destina cada porción del total.
CREATE TABLE IF NOT EXISTS contabilidad.recibo_detalle (
    id                            BIGSERIAL PRIMARY KEY,

    id_recibo                     BIGINT NOT NULL
                                  REFERENCES contabilidad.recibo (id)
                                  ON DELETE RESTRICT,

    destino                       VARCHAR(10) NOT NULL,  -- PERSONAL | ACTOR | EFECTIVO

    id_persona                    BIGINT
                                  REFERENCES comercio_interno.persona_ci (id)
                                  ON DELETE RESTRICT,
    id_actor_productivo_minero    BIGINT
                                  REFERENCES parametrica.actor_productivo_minero (id)
                                  ON DELETE RESTRICT,

    monto                         NUMERIC(16,2) NOT NULL,

    -- Línea de kardex generada por esta porción. NULL si destino=EFECTIVO.
    id_movimiento_kardex          BIGINT
                                  REFERENCES contabilidad.movimiento_kardex (id)
                                  ON DELETE RESTRICT,

    -- columnas de auditoría (mismo patrón que el resto de la base)
    activo                        BOOLEAN NOT NULL DEFAULT TRUE,
    usuario_registro              VARCHAR(100) NOT NULL,
    usuario_ultima_modificacion   VARCHAR(100),
    fecha_registro                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_ultima_modificacion     TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT ck_recibo_detalle_destino CHECK (destino IN ('PERSONAL', 'ACTOR', 'EFECTIVO')),
    CONSTRAINT ck_recibo_detalle_monto_positivo CHECK (monto > 0),
    CONSTRAINT ck_recibo_detalle_destinatario CHECK (
        (destino = 'PERSONAL' AND id_persona IS NOT NULL AND id_actor_productivo_minero IS NULL) OR
        (destino = 'ACTOR'    AND id_actor_productivo_minero IS NOT NULL AND id_persona IS NULL) OR
        (destino = 'EFECTIVO' AND id_persona IS NULL AND id_actor_productivo_minero IS NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_recibo_detalle_recibo
    ON contabilidad.recibo_detalle (id_recibo);
