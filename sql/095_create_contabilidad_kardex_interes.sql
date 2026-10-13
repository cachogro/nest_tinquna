-- Intereses por mora sobre un kardex (ACTOR, ASOCIADO o PERSONAL).
--
-- Cuando un deudor tiene una deuda grande y no cumple con los pagos se le
-- aplica un interés MENSUAL sobre lo que debe. El interés se lleva APARTE
-- del kardex (no toca su saldo mientras se devenga) porque es negociable:
-- al momento de cobrarle, el jefe puede bajarle la tasa (se recalculan
-- todos los meses pendientes) o perdonárselo (condonación). Recién cuando
-- hay acuerdo, lo pendiente se CARGA al kardex como una línea DEBE sin
-- movimiento de dinero, y desde ahí se cobra como cualquier otra deuda.
--
-- contabilidad.kardex_interes
--   Plan de interés de un kardex: tasa mensual (%) y desde cuándo corre.
--     VIGENTE:    sigue generando una cuota cada mes (uno solo por kardex).
--     FINALIZADO: dejó de generar cuotas (por condonación, por decisión del
--                 operador o porque se cobró y se cortó). Sus cuotas
--                 pendientes siguen ahí hasta cargarlas o condonarlas.
--
-- contabilidad.kardex_interes_cuota
--   Una fila por mes devengado. El mes N va de fecha_desde a fecha_corte
--   (fecha_inicio + N meses) y su monto = saldo_base x tasa / 100, donde
--   saldo_base es el saldo del kardex al día de corte.
--     PENDIENTE: devengada, todavía negociable (se recalcula sola si cambia
--                la tasa o si se corrige un movimiento anterior al corte).
--     CARGADO:   ya está en el kardex (id_movimiento_kardex = su línea DEBE).
--     CONDONADO: perdonada, no se cobra.
--
-- contabilidad.kardex_interes_evento
--   Bitácora de lo que se decidió sobre el plan (quién, cuándo, por qué).

CREATE TABLE IF NOT EXISTS contabilidad.kardex_interes (
    id                            BIGSERIAL PRIMARY KEY,

    id_kardex                     BIGINT NOT NULL
                                  REFERENCES contabilidad.kardex (id) ON DELETE RESTRICT,

    -- Porcentaje mensual, ej. 3.0000 = 3 % al mes.
    tasa_mensual                  NUMERIC(7, 4) NOT NULL,
    -- Desde cuándo corre. La primera cuota vence un mes después.
    fecha_inicio                  DATE NOT NULL,
    estado                        VARCHAR(12) NOT NULL DEFAULT 'VIGENTE',
    fecha_fin                     DATE,
    observaciones                 VARCHAR(500),

    activo                        BOOLEAN NOT NULL DEFAULT TRUE,
    usuario_registro              VARCHAR(100) NOT NULL,
    usuario_ultima_modificacion   VARCHAR(100),
    fecha_registro                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_ultima_modificacion     TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT ck_kardex_interes_estado CHECK (estado IN ('VIGENTE', 'FINALIZADO')),
    CONSTRAINT ck_kardex_interes_tasa CHECK (tasa_mensual > 0 AND tasa_mensual <= 100)
);

CREATE INDEX IF NOT EXISTS idx_kardex_interes_kardex
    ON contabilidad.kardex_interes (id_kardex);
-- Un solo plan VIGENTE por kardex.
CREATE UNIQUE INDEX IF NOT EXISTS uq_kardex_interes_vigente
    ON contabilidad.kardex_interes (id_kardex)
    WHERE estado = 'VIGENTE' AND activo;


CREATE TABLE IF NOT EXISTS contabilidad.kardex_interes_cuota (
    id                            BIGSERIAL PRIMARY KEY,

    id_kardex_interes             BIGINT NOT NULL
                                  REFERENCES contabilidad.kardex_interes (id) ON DELETE RESTRICT,
    numero                        INT NOT NULL,
    fecha_desde                   DATE NOT NULL,
    fecha_corte                   DATE NOT NULL,

    saldo_base                    NUMERIC(16, 2) NOT NULL,
    tasa                          NUMERIC(7, 4) NOT NULL,
    monto                         NUMERIC(16, 2) NOT NULL,
    estado                        VARCHAR(10) NOT NULL DEFAULT 'PENDIENTE',

    -- Línea DEBE del kardex con la que se cargó (solo en CARGADO).
    id_movimiento_kardex          BIGINT
                                  REFERENCES contabilidad.movimiento_kardex (id) ON DELETE RESTRICT,

    activo                        BOOLEAN NOT NULL DEFAULT TRUE,
    usuario_registro              VARCHAR(100) NOT NULL,
    usuario_ultima_modificacion   VARCHAR(100),
    fecha_registro                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_ultima_modificacion     TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT uq_kardex_interes_cuota_numero UNIQUE (id_kardex_interes, numero),
    CONSTRAINT ck_kardex_interes_cuota_estado CHECK (
        estado IN ('PENDIENTE', 'CARGADO', 'CONDONADO')
    ),
    CONSTRAINT ck_kardex_interes_cuota_importes CHECK (saldo_base >= 0 AND monto >= 0),
    CONSTRAINT ck_kardex_interes_cuota_cargo CHECK (
        (estado = 'CARGADO') = (id_movimiento_kardex IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_kardex_interes_cuota_plan
    ON contabilidad.kardex_interes_cuota (id_kardex_interes);
CREATE INDEX IF NOT EXISTS idx_kardex_interes_cuota_movimiento
    ON contabilidad.kardex_interes_cuota (id_movimiento_kardex);


CREATE TABLE IF NOT EXISTS contabilidad.kardex_interes_evento (
    id                            BIGSERIAL PRIMARY KEY,

    id_kardex_interes             BIGINT NOT NULL
                                  REFERENCES contabilidad.kardex_interes (id) ON DELETE RESTRICT,
    tipo                          VARCHAR(20) NOT NULL,
    fecha                         DATE NOT NULL,

    -- CAMBIO_TASA: tasa y total pendiente antes y después del recálculo.
    tasa_anterior                 NUMERIC(7, 4),
    tasa_nueva                    NUMERIC(7, 4),
    monto_anterior                NUMERIC(16, 2),
    -- Importe afectado: lo cargado, lo condonado o el nuevo total pendiente.
    monto                         NUMERIC(16, 2),
    cuotas                        INT,
    observacion                   VARCHAR(500),
    -- CARGO_KARDEX / REVERSION_CARGO: la línea del kardex.
    id_movimiento_kardex          BIGINT
                                  REFERENCES contabilidad.movimiento_kardex (id) ON DELETE RESTRICT,

    activo                        BOOLEAN NOT NULL DEFAULT TRUE,
    usuario_registro              VARCHAR(100) NOT NULL,
    usuario_ultima_modificacion   VARCHAR(100),
    fecha_registro                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_ultima_modificacion     TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT ck_kardex_interes_evento_tipo CHECK (
        tipo IN ('APLICACION', 'CAMBIO_TASA', 'CONDONACION', 'CARGO_KARDEX',
                 'REVERSION_CARGO', 'FINALIZACION')
    )
);

CREATE INDEX IF NOT EXISTS idx_kardex_interes_evento_plan
    ON contabilidad.kardex_interes_evento (id_kardex_interes);
