-- Tabla: contabilidad.periodo_caja
-- Período de la caja de flujo (mismo mecanismo que contabilidad.periodo_banco):
--   * MENSUAL: mes 1-12, tramo de carga.
--   * GESTION: mes NULL, resumen anual; se cierra cuando sus 12 meses están cerrados.
-- Una caja opera en varias monedas a la vez (ver parametrica.caja), por lo
-- que cada (caja, moneda) lleva su propia cadena de períodos independiente.
-- El saldo NO se reinicia: saldo_final de un mes es el saldo_inicial del
-- siguiente (dentro de la misma moneda).

CREATE TABLE IF NOT EXISTS contabilidad.periodo_caja (
    id                           BIGSERIAL PRIMARY KEY,

    id_caja                      INTEGER NOT NULL
                                 REFERENCES parametrica.caja (id)
                                 ON DELETE RESTRICT,
    moneda                       VARCHAR(3) NOT NULL,   -- BOB | USD

    tipo                         VARCHAR(10) NOT NULL,  -- MENSUAL | GESTION
    gestion                      INTEGER NOT NULL,
    mes                          INTEGER,                -- 1-12 en MENSUAL; NULL en GESTION

    estado                       VARCHAR(10) NOT NULL DEFAULT 'ABIERTO',  -- ABIERTO | CERRADO

    saldo_inicial                NUMERIC(16,2) NOT NULL DEFAULT 0,
    total_ingreso                NUMERIC(16,2) NOT NULL DEFAULT 0,
    total_egreso                 NUMERIC(16,2) NOT NULL DEFAULT 0,
    saldo_final                  NUMERIC(16,2),

    responsable                  VARCHAR(100),   -- responsable de caja del período (texto libre)

    fecha_cierre                 DATE,
    cerrado_por                  VARCHAR(100),

    -- columnas de auditoría (mismo patrón que el resto de la base)
    activo                       BOOLEAN NOT NULL DEFAULT TRUE,
    usuario_registro             VARCHAR(100) NOT NULL,
    usuario_ultima_modificacion  VARCHAR(100),
    fecha_registro               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_ultima_modificacion    TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT ck_periodo_caja_moneda CHECK (moneda IN ('BOB', 'USD')),
    CONSTRAINT ck_periodo_caja_tipo   CHECK (tipo IN ('MENSUAL', 'GESTION')),
    CONSTRAINT ck_periodo_caja_estado CHECK (estado IN ('ABIERTO', 'CERRADO')),
    CONSTRAINT ck_periodo_caja_mes CHECK (
        (tipo = 'MENSUAL' AND mes BETWEEN 1 AND 12) OR
        (tipo = 'GESTION' AND mes IS NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_periodo_caja_mensual
    ON contabilidad.periodo_caja (id_caja, moneda, gestion, mes)
    WHERE tipo = 'MENSUAL';

CREATE UNIQUE INDEX IF NOT EXISTS uq_periodo_caja_gestion
    ON contabilidad.periodo_caja (id_caja, moneda, gestion)
    WHERE tipo = 'GESTION';

CREATE INDEX IF NOT EXISTS idx_periodo_caja_caja_moneda
    ON contabilidad.periodo_caja (id_caja, moneda, gestion, mes);
