-- Pago mixto: un recibo (y lo que genera un recibo: boleta de pago,
-- préstamo, anticipo de recepción) o un pago de valorización puede salir por
-- más de un medio a la vez — por ejemplo, la mitad en efectivo (caja de
-- flujo) y el resto por QR o transferencia (libreta de bancos).
--
-- Estas tablas solo tienen filas cuando el pago es MIXTO (dos medios o más).
-- Con un solo medio todo sigue como antes: la forma de pago, la cuenta y el
-- N° de comprobante viven en la cabecera. En un pago mixto la cabecera
-- conserva los datos del primer medio (el principal).

CREATE TABLE IF NOT EXISTS contabilidad.recibo_pago (
    id                          BIGSERIAL PRIMARY KEY,

    id_recibo                   BIGINT NOT NULL
                                REFERENCES contabilidad.recibo (id) ON DELETE CASCADE,
    orden                       INT NOT NULL DEFAULT 1,
    id_forma_pago               INT NOT NULL
                                REFERENCES parametrica.forma_pago (id) ON DELETE RESTRICT,
    id_cuenta_bancaria          INT REFERENCES parametrica.cuenta_bancaria (id) ON DELETE RESTRICT,
    nro_comprobante             VARCHAR(30),
    -- En la moneda del recibo.
    monto                       NUMERIC(16, 2) NOT NULL,

    activo                      BOOLEAN NOT NULL DEFAULT TRUE,
    usuario_registro            VARCHAR(100) NOT NULL,
    usuario_ultima_modificacion VARCHAR(100),
    fecha_registro              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_ultima_modificacion   TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT ck_recibo_pago_monto CHECK (monto > 0)
);

CREATE INDEX IF NOT EXISTS ix_recibo_pago_recibo
    ON contabilidad.recibo_pago (id_recibo);

CREATE TABLE IF NOT EXISTS contabilidad.pago_valorizacion_medio (
    id                          BIGSERIAL PRIMARY KEY,

    id_pago_valorizacion        BIGINT NOT NULL
                                REFERENCES contabilidad.pago_valorizacion (id) ON DELETE CASCADE,
    orden                       INT NOT NULL DEFAULT 1,
    id_forma_pago               INT NOT NULL
                                REFERENCES parametrica.forma_pago (id) ON DELETE RESTRICT,
    id_cuenta_bancaria          INT REFERENCES parametrica.cuenta_bancaria (id) ON DELETE RESTRICT,
    nro_comprobante             VARCHAR(30),
    monto                       NUMERIC(16, 2) NOT NULL,

    -- Movimiento que generó este medio: en caja (efectivo) o en la libreta.
    id_movimiento_caja          BIGINT REFERENCES contabilidad.movimiento_caja (id) ON DELETE RESTRICT,
    id_libreta_banco            BIGINT REFERENCES contabilidad.libreta_banco (id) ON DELETE RESTRICT,

    activo                      BOOLEAN NOT NULL DEFAULT TRUE,
    usuario_registro            VARCHAR(100) NOT NULL,
    usuario_ultima_modificacion VARCHAR(100),
    fecha_registro              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_ultima_modificacion   TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT ck_pago_valorizacion_medio_monto CHECK (monto > 0)
);

CREATE INDEX IF NOT EXISTS ix_pago_valorizacion_medio_pago
    ON contabilidad.pago_valorizacion_medio (id_pago_valorizacion);
CREATE INDEX IF NOT EXISTS ix_pago_valorizacion_medio_caja
    ON contabilidad.pago_valorizacion_medio (id_movimiento_caja);
CREATE INDEX IF NOT EXISTS ix_pago_valorizacion_medio_libreta
    ON contabilidad.pago_valorizacion_medio (id_libreta_banco);
