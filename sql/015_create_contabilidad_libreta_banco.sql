-- Esquema y tabla: contabilidad.libreta_banco
-- "Libreta de bancos": el mayor de cada cuenta bancaria de la empresa.
-- Una fila por movimiento. Los registros se cargan MANUALMENTE.
-- La cuenta arranca con una fila de saldo inicial (es_apertura = TRUE):
-- monto exacto en HABER y ese mismo valor en SALDO.
--   DEBE  = salida / cargo   (egreso)
--   HABER = entrada / abono  (ingreso, depósito, apertura)
--   SALDO = saldo corriente tras el movimiento = saldo_anterior - debe + haber
-- La moneda es la de la cuenta (parametrica.cuenta_bancaria.moneda).

CREATE SCHEMA IF NOT EXISTS contabilidad;

CREATE TABLE IF NOT EXISTS contabilidad.libreta_banco (
    id                           BIGSERIAL PRIMARY KEY,

    id_cuenta_bancaria           INTEGER NOT NULL
                                 REFERENCES parametrica.cuenta_bancaria (id)
                                 ON DELETE RESTRICT,

    fecha                        DATE NOT NULL,
    nro_transaccion              VARCHAR(30),          -- N° de transacción del banco ("SG EXTRACTO" en la apertura)
    nombres_apellidos            VARCHAR(255),         -- beneficiario / contraparte (texto libre)
    concepto                     VARCHAR(255) NOT NULL,

    debe                         NUMERIC(16,2) NOT NULL DEFAULT 0,
    haber                        NUMERIC(16,2) NOT NULL DEFAULT 0,
    saldo                        NUMERIC(16,2) NOT NULL,

    es_apertura                  BOOLEAN NOT NULL DEFAULT FALSE,

    -- columnas de auditoría (mismo patrón que el resto de la base)
    activo                       BOOLEAN NOT NULL DEFAULT TRUE,
    usuario_registro             VARCHAR(100) NOT NULL,
    usuario_ultima_modificacion  VARCHAR(100),
    fecha_registro               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_ultima_modificacion    TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT ck_libreta_banco_montos_no_negativos
        CHECK (debe >= 0 AND haber >= 0),
    CONSTRAINT ck_libreta_banco_debe_o_haber
        CHECK ((debe > 0 AND haber = 0) OR (haber > 0 AND debe = 0))
);

-- Una sola fila de saldo inicial por cuenta.
CREATE UNIQUE INDEX IF NOT EXISTS uq_libreta_banco_apertura
    ON contabilidad.libreta_banco (id_cuenta_bancaria)
    WHERE es_apertura = TRUE;

-- Recorrido de la libreta de una cuenta en orden cronológico.
CREATE INDEX IF NOT EXISTS idx_libreta_banco_cuenta_fecha
    ON contabilidad.libreta_banco (id_cuenta_bancaria, fecha, id);

-- Sin seed: la libreta se carga manualmente. La primera fila de cada cuenta
-- es su saldo inicial (es_apertura = TRUE).
