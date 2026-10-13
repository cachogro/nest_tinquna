-- Tabla: contabilidad.bien_dacion_pago
--
-- Dación en pago: un actor productivo minero o una persona asociada a uno
-- entrega un bien (ej. un auto) en lugar de efectivo, para más adelante
-- saldar (total o parcialmente) su deuda en el kardex. Esta tabla es solo
-- el ANTECEDENTE/registro del bien mientras está en poder de la empresa:
-- qué se recibió, de quién y un valor referencial (avalúo aproximado, no
-- exacto). A PROPÓSITO no genera ningún movimiento de kardex ni de caja en
-- ningún punto de este alcance (ni al recibir, ni al vender, ni al
-- devolver) — conectar la eventual venta con saldar la deuda real del
-- kardex es un paso aparte, todavía no construido.
--
--   EN_POSESION: la empresa tiene el bien, pendiente de vender o devolver.
--   VENDIDO:     se vendió (fecha_venta, monto_venta).
--   DEVUELTO:    se le devolvió al destinatario (fecha_devolucion); el motivo
--                se anota en `observaciones`, no hay un campo aparte.

CREATE TABLE IF NOT EXISTS contabilidad.bien_dacion_pago (
    id                            BIGSERIAL PRIMARY KEY,

    id_persona                    BIGINT
                                  REFERENCES comercio_interno.persona_ci (id) ON DELETE RESTRICT,
    id_actor_productivo_minero    BIGINT
                                  REFERENCES parametrica.actor_productivo_minero (id) ON DELETE RESTRICT,

    fecha_recepcion               DATE NOT NULL,
    descripcion                   VARCHAR(255) NOT NULL,
    valor_referencial             NUMERIC(16, 2),

    estado                        VARCHAR(15) NOT NULL DEFAULT 'EN_POSESION',

    fecha_venta                   DATE,
    monto_venta                   NUMERIC(16, 2),

    fecha_devolucion              DATE,

    observaciones                 VARCHAR(500),

    activo                        BOOLEAN NOT NULL DEFAULT TRUE,
    usuario_registro              VARCHAR(100) NOT NULL,
    usuario_ultima_modificacion   VARCHAR(100),
    fecha_registro                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_ultima_modificacion     TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT ck_bien_dacion_pago_estado CHECK (
        estado IN ('EN_POSESION', 'VENDIDO', 'DEVUELTO')
    ),
    CONSTRAINT ck_bien_dacion_pago_destinatario CHECK (
        (id_persona IS NOT NULL AND id_actor_productivo_minero IS NULL) OR
        (id_persona IS NULL AND id_actor_productivo_minero IS NOT NULL)
    ),
    CONSTRAINT ck_bien_dacion_pago_valor CHECK (valor_referencial IS NULL OR valor_referencial > 0),
    CONSTRAINT ck_bien_dacion_pago_monto_venta CHECK (monto_venta IS NULL OR monto_venta > 0)
);

CREATE INDEX IF NOT EXISTS idx_bien_dacion_pago_persona
    ON contabilidad.bien_dacion_pago (id_persona);
CREATE INDEX IF NOT EXISTS idx_bien_dacion_pago_actor
    ON contabilidad.bien_dacion_pago (id_actor_productivo_minero);
CREATE INDEX IF NOT EXISTS idx_bien_dacion_pago_estado
    ON contabilidad.bien_dacion_pago (estado);
