-- Pago de una valorización de mineral (transacción interna, SIN recibo).
--
-- Al terminar de valorizar ya no se emite recibo: el respaldo es el PDF de la
-- valorización firmado por ambas partes. El pago del líquido pagable se
-- registra acá, una sola vez por valorización VALORIZADA.
--
-- contabilidad.pago_valorizacion
--   monto_liquido       líquido pagable de la valorización al registrar.
--   monto_abono_kardex  parte del líquido que el proveedor decide dejar a un
--                       kardex (HABER: baja esa deuda). Opcional.
--   monto_pagado        lo que sale de verdad = líquido − abonos. Es lo ÚNICO
--                       que va a la caja de flujo (efectivo, EGRESO) o a la
--                       libreta bancaria (QR/transferencia/cheque/depósito,
--                       DEBE). NO se anota en ningún kardex.
--   id_movimiento_caja / id_libreta_banco: el movimiento generado (uno de
--                       los dos, o ninguno si todo el líquido quedó en kardex).
--   estado              REGISTRADO | ANULADO. Anular da de baja el movimiento
--                       de caja/libreta y las líneas de kardex.
--
-- contabilidad.pago_valorizacion_detalle — líneas de kardex del pago (HABER):
--   ABONO            lo que el proveedor deja a un kardex de su líquido.
--   ANTICIPO         cancela el anticipo de la recepción en el kardex donde
--                    el recibo de anticipo lo cargó como deuda (la
--                    valorización ya lo descontó del líquido).
--   OTROS_ANTICIPOS  cancela los "otros anticipos" descontados en la
--                    valorización, en el kardex que se elija.

CREATE TABLE IF NOT EXISTS contabilidad.pago_valorizacion (
    id                          BIGSERIAL PRIMARY KEY,

    id_valorizacion_mineral     BIGINT NOT NULL
                                REFERENCES comercio_interno.valorizacion_mineral (id) ON DELETE RESTRICT,
    fecha                       DATE NOT NULL,

    monto_liquido               NUMERIC(16, 2) NOT NULL,
    monto_abono_kardex          NUMERIC(16, 2) NOT NULL DEFAULT 0,
    monto_pagado                NUMERIC(16, 2) NOT NULL DEFAULT 0,

    id_forma_pago               INT REFERENCES parametrica.forma_pago (id) ON DELETE RESTRICT,
    id_cuenta_bancaria          INT REFERENCES parametrica.cuenta_bancaria (id) ON DELETE RESTRICT,
    nro_comprobante             VARCHAR(30),
    id_destino_gasto            INT REFERENCES parametrica.destino_gasto (id) ON DELETE RESTRICT,

    id_persona_autorizo         BIGINT NOT NULL,
    persona_autorizo            JSONB,

    id_movimiento_caja          BIGINT REFERENCES contabilidad.movimiento_caja (id) ON DELETE RESTRICT,
    id_libreta_banco            BIGINT REFERENCES contabilidad.libreta_banco (id) ON DELETE RESTRICT,

    estado                      VARCHAR(12) NOT NULL DEFAULT 'REGISTRADO',

    activo                      BOOLEAN NOT NULL DEFAULT TRUE,
    usuario_registro            VARCHAR(100) NOT NULL,
    usuario_ultima_modificacion VARCHAR(100),
    fecha_registro              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_ultima_modificacion   TIMESTAMPTZ
);

-- Un solo pago vigente por valorización (uno ANULADO la libera).
CREATE UNIQUE INDEX IF NOT EXISTS uq_pago_valorizacion_vigente
    ON contabilidad.pago_valorizacion (id_valorizacion_mineral)
    WHERE estado <> 'ANULADO';

CREATE TABLE IF NOT EXISTS contabilidad.pago_valorizacion_detalle (
    id                          BIGSERIAL PRIMARY KEY,

    id_pago_valorizacion        BIGINT NOT NULL
                                REFERENCES contabilidad.pago_valorizacion (id) ON DELETE CASCADE,
    concepto                    VARCHAR(20) NOT NULL,
    id_kardex                   BIGINT NOT NULL
                                REFERENCES contabilidad.kardex (id) ON DELETE RESTRICT,
    monto                       NUMERIC(16, 2) NOT NULL,
    id_movimiento_kardex        BIGINT
                                REFERENCES contabilidad.movimiento_kardex (id) ON DELETE RESTRICT,

    activo                      BOOLEAN NOT NULL DEFAULT TRUE,
    usuario_registro            VARCHAR(100) NOT NULL,
    usuario_ultima_modificacion VARCHAR(100),
    fecha_registro              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_ultima_modificacion   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pago_valorizacion_detalle_pago
    ON contabilidad.pago_valorizacion_detalle (id_pago_valorizacion);
CREATE INDEX IF NOT EXISTS idx_pago_valorizacion_detalle_kardex
    ON contabilidad.pago_valorizacion_detalle (id_kardex);
