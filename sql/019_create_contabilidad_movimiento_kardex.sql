-- Catálogo: parametrica.tipo_movimiento_kardex
-- Clase de asiento dentro de un kardex de anticipos.
CREATE TABLE IF NOT EXISTS parametrica.tipo_movimiento_kardex (
    id                           SERIAL PRIMARY KEY,
    codigo                       VARCHAR(30) NOT NULL,
    nombre                       VARCHAR(60) NOT NULL,
    signo                        CHAR(1) NOT NULL,   -- D (debe) | H (haber) -- informativo

    activo                       BOOLEAN NOT NULL DEFAULT TRUE,
    usuario_registro             VARCHAR(100) NOT NULL,
    usuario_ultima_modificacion  VARCHAR(100),
    fecha_registro               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_ultima_modificacion    TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT ck_tipo_movimiento_kardex_signo CHECK (signo IN ('D', 'H'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tipo_movimiento_kardex_codigo
    ON parametrica.tipo_movimiento_kardex (codigo);

INSERT INTO parametrica.tipo_movimiento_kardex (codigo, nombre, signo, usuario_registro) VALUES
    ('ANTICIPO',       'ANTICIPO A CUENTA',        'D', 'sistema'),
    ('RECONOCIMIENTO', 'RECONOCIMIENTO DE GASTO',  'D', 'sistema'),
    ('PAGO',           'PAGO / CANCELACION',       'H', 'sistema'),
    ('TRANZADO',       'VALORIZACION TRANZADA',    'H', 'sistema'),
    ('DSCT_LEY',       'DESCUENTO DE LEY',         'H', 'sistema'),
    ('DSCT_ANTICIPO',  'DESCUENTO DE ANTICIPO',    'H', 'sistema'),
    ('DEVOLUCION',     'DEVOLUCION',               'H', 'sistema'),
    ('OTRO',           'OTRO',                     'D', 'sistema')
ON CONFLICT DO NOTHING;

-- Tabla: contabilidad.movimiento_kardex
-- Líneas del kardex (hoja 2 del Excel). numero_linea reinicia en 1 por cada
-- kardex (cada apertura N°1, N°2... es una fila distinta en contabilidad.kardex).
--   DEBE  = anticipo entregado (sube la deuda del destinatario)
--   HABER = pago / descuento (la baja)
--   SALDO = saldo corriente tras el movimiento
CREATE TABLE IF NOT EXISTS contabilidad.movimiento_kardex (
    id                           BIGSERIAL PRIMARY KEY,

    id_kardex                    BIGINT NOT NULL
                                 REFERENCES contabilidad.kardex (id)
                                 ON DELETE RESTRICT,
    numero_linea                 INTEGER NOT NULL,

    fecha                        DATE NOT NULL,
    nro_comprobante              VARCHAR(30),
    detalle                      VARCHAR(255) NOT NULL,

    id_subcuenta                 INTEGER
                                 REFERENCES parametrica.kardex_subcuenta (id)
                                 ON DELETE RESTRICT,
    id_forma_pago                INTEGER
                                 REFERENCES parametrica.forma_pago (id)
                                 ON DELETE RESTRICT,
    id_tipo_movimiento           INTEGER
                                 REFERENCES parametrica.tipo_movimiento_kardex (id)
                                 ON DELETE RESTRICT,
    id_cobrador                  BIGINT
                                 REFERENCES comercio_interno.persona_ci (id)
                                 ON DELETE RESTRICT,
    id_valorizacion              BIGINT
                                 REFERENCES comercio_interno.valorizacion_mineral (id)
                                 ON DELETE RESTRICT,

    debe                         NUMERIC(16,2) NOT NULL DEFAULT 0,
    haber                        NUMERIC(16,2) NOT NULL DEFAULT 0,
    saldo                        NUMERIC(16,2) NOT NULL,

    -- columnas de auditoría (mismo patrón que el resto de la base)
    activo                       BOOLEAN NOT NULL DEFAULT TRUE,
    usuario_registro             VARCHAR(100) NOT NULL,
    usuario_ultima_modificacion  VARCHAR(100),
    fecha_registro               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_ultima_modificacion    TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT ck_movimiento_kardex_montos_no_negativos
        CHECK (debe >= 0 AND haber >= 0),
    CONSTRAINT ck_movimiento_kardex_debe_o_haber
        CHECK ((debe > 0 AND haber = 0) OR (haber > 0 AND debe = 0))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_movimiento_kardex_linea
    ON contabilidad.movimiento_kardex (id_kardex, numero_linea);

CREATE INDEX IF NOT EXISTS idx_movimiento_kardex_kardex_fecha
    ON contabilidad.movimiento_kardex (id_kardex, fecha, id);
