-- Tabla: contabilidad.movimiento_caja
-- Caja de flujo (hoja "CAJA DE FLUJO" del Excel). Una fila por ingreso o
-- egreso físico de efectivo. Igual mecanismo que contabilidad.libreta_banco,
-- con nombres de columna en el lenguaje de la caja:
--   ingreso = entrada de efectivo
--   egreso  = salida de efectivo
--   saldo   = saldo corriente tras el movimiento, calculado por el servicio
--             dentro de la misma moneda del movimiento.
-- Las columnas de referencia por banco del Excel (BANCO UNION/BCP/SOL...) no
-- se modelan aquí: esos movimientos ya se registran en libreta_banco.

CREATE TABLE IF NOT EXISTS contabilidad.movimiento_caja (
    id                           BIGSERIAL PRIMARY KEY,

    id_caja                      INTEGER NOT NULL
                                 REFERENCES parametrica.caja (id)
                                 ON DELETE RESTRICT,
    id_periodo_caja               BIGINT NOT NULL
                                 REFERENCES contabilidad.periodo_caja (id)
                                 ON DELETE RESTRICT,
    moneda                       VARCHAR(3) NOT NULL,   -- BOB | USD, debe coincidir con el período

    folio                         INTEGER,               -- correlativo por (caja, moneda, gestión)

    fecha                         DATE NOT NULL,
    nro_comprobante               VARCHAR(30),           -- "REC:R-0009", "BCL-737", "ICC-738"...

    id_forma_pago                 INTEGER
                                 REFERENCES parametrica.forma_pago (id)
                                 ON DELETE RESTRICT,

    -- "ENTREGA DE FONDOS A:" del Excel.
    id_persona                    BIGINT
                                 REFERENCES comercio_interno.persona_ci (id)
                                 ON DELETE RESTRICT,
    nombres_apellidos             VARCHAR(255),

    concepto                      VARCHAR(255) NOT NULL,
    destino_gasto                 VARCHAR(255),          -- "DESTINO DEL GASTO" (texto libre por ahora)

    ingreso                       NUMERIC(16,2) NOT NULL DEFAULT 0,
    egreso                        NUMERIC(16,2) NOT NULL DEFAULT 0,
    saldo                         NUMERIC(16,2) NOT NULL,

    -- columnas de auditoría (mismo patrón que el resto de la base)
    activo                        BOOLEAN NOT NULL DEFAULT TRUE,
    usuario_registro              VARCHAR(100) NOT NULL,
    usuario_ultima_modificacion   VARCHAR(100),
    fecha_registro                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_ultima_modificacion     TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT ck_movimiento_caja_moneda CHECK (moneda IN ('BOB', 'USD')),
    CONSTRAINT ck_movimiento_caja_montos_no_negativos
        CHECK (ingreso >= 0 AND egreso >= 0),
    CONSTRAINT ck_movimiento_caja_ingreso_o_egreso
        CHECK ((ingreso > 0 AND egreso = 0) OR (egreso > 0 AND ingreso = 0))
);

CREATE INDEX IF NOT EXISTS idx_movimiento_caja_periodo
    ON contabilidad.movimiento_caja (id_periodo_caja);

CREATE INDEX IF NOT EXISTS idx_movimiento_caja_caja_moneda_fecha
    ON contabilidad.movimiento_caja (id_caja, moneda, fecha, id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_movimiento_caja_folio
    ON contabilidad.movimiento_caja (id_caja, moneda, folio)
    WHERE folio IS NOT NULL;
