-- Tabla: contabilidad.traspaso
-- Traspaso interno de fondos propios de la empresa entre la caja de flujo y
-- una cuenta bancaria (ej. depositar efectivo de caja al banco, o retirar
-- del banco a caja). NO es un ingreso/egreso real del negocio ni una
-- transacción con un tercero (a diferencia de un recibo o un movimiento de
-- kardex): es la misma plata cambiando de custodia. Por eso genera, en la
-- misma transacción, un movimiento en contabilidad.movimiento_caja y otro en
-- contabilidad.libreta_banco, enlazados a esta cabecera vía id_traspaso
-- (mismo patrón que id_recibo / id_movimiento_kardex en esas tablas).
--
--   DEPOSITO: la plata sale de la caja (EGRESO) y entra al banco (HABER).
--   RETIRO:   la plata sale del banco (DEBE) y entra a la caja (INGRESO).

CREATE TABLE IF NOT EXISTS contabilidad.traspaso (
    id                           BIGSERIAL PRIMARY KEY,

    tipo                         VARCHAR(10) NOT NULL,   -- DEPOSITO | RETIRO
    fecha                        DATE NOT NULL,

    id_caja                      INTEGER NOT NULL
                                 REFERENCES parametrica.caja (id) ON DELETE RESTRICT,
    -- 'BOB' | 'USD' (misma moneda de movimiento_caja; parametrica.cuenta_bancaria
    -- usa 'BS'/'USD' para el mismo concepto, se traduce BS -> BOB acá).
    moneda                       VARCHAR(3) NOT NULL,

    id_cuenta_bancaria           INTEGER NOT NULL
                                 REFERENCES parametrica.cuenta_bancaria (id) ON DELETE RESTRICT,

    -- N° de la boleta de depósito / retiro del banco, si corresponde.
    nro_comprobante              VARCHAR(30),
    concepto                     VARCHAR(255) NOT NULL,
    monto                        NUMERIC(16, 2) NOT NULL,

    -- columnas de auditoría (mismo patrón que el resto de la base)
    activo                       BOOLEAN NOT NULL DEFAULT TRUE,
    usuario_registro             VARCHAR(100) NOT NULL,
    usuario_ultima_modificacion  VARCHAR(100),
    fecha_registro               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_ultima_modificacion    TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT ck_traspaso_tipo   CHECK (tipo IN ('DEPOSITO', 'RETIRO')),
    CONSTRAINT ck_traspaso_moneda CHECK (moneda IN ('BOB', 'USD')),
    CONSTRAINT ck_traspaso_monto  CHECK (monto > 0)
);

CREATE INDEX IF NOT EXISTS idx_traspaso_caja
    ON contabilidad.traspaso (id_caja, moneda);
CREATE INDEX IF NOT EXISTS idx_traspaso_cuenta_bancaria
    ON contabilidad.traspaso (id_cuenta_bancaria);

-- Back-reference desde cada lado hacia el traspaso que lo generó (igual
-- patrón que id_recibo / id_movimiento_kardex en estas mismas tablas).
ALTER TABLE contabilidad.movimiento_caja
    ADD COLUMN IF NOT EXISTS id_traspaso BIGINT
        REFERENCES contabilidad.traspaso (id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_movimiento_caja_traspaso
    ON contabilidad.movimiento_caja (id_traspaso);

ALTER TABLE contabilidad.libreta_banco
    ADD COLUMN IF NOT EXISTS id_traspaso BIGINT
        REFERENCES contabilidad.traspaso (id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_libreta_banco_traspaso
    ON contabilidad.libreta_banco (id_traspaso);
