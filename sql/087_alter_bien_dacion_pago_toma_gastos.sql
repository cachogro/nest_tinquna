-- contabilidad.bien_dacion_pago: ciclo completo del bien recibido en dación.
--
--   EN_POSESION    -> la empresa lo retiene; se puede devolver (no genera
--                     nada), vender directo o tomar en pago.
--   TOMADO_EN_PAGO -> la empresa se queda con el bien: el valor acordado
--                     (monto_amortizado) se abona como HABER en el kardex del
--                     dueño, sin mover caja. Desde acá ya no se devuelve, se
--                     le pueden cargar gastos (bien_dacion_pago_gasto) y
--                     venderlo solo mueve caja/banco.
--   VENDIDO        -> el precio entra DIRECTO a la caja de flujo o a la
--                     libreta de bancos (id_movimiento_caja / id_libreta_banco),
--                     sin recibo. En una venta directa (desde EN_POSESION) el
--                     mismo paso abona monto_amortizado al kardex.
--   DEVUELTO       -> se le devolvió al dueño.
--
-- `valor_referencial` pasa a ser el VALOR ACORDADO con el dueño (lo que se
-- propone amortizar). Resultado de la venta para la empresa =
-- monto_venta - monto_amortizado - gastos del bien.
--
-- id_recibo queda solo para los bienes vendidos antes de este cambio.

BEGIN;

ALTER TABLE contabilidad.bien_dacion_pago
    ADD COLUMN IF NOT EXISTS fecha_toma_pago DATE,
    ADD COLUMN IF NOT EXISTS monto_amortizado NUMERIC(16, 2),
    ADD COLUMN IF NOT EXISTS id_movimiento_caja BIGINT
        REFERENCES contabilidad.movimiento_caja (id) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS id_libreta_banco BIGINT
        REFERENCES contabilidad.libreta_banco (id) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS persona_autorizo JSONB;

ALTER TABLE contabilidad.bien_dacion_pago
    DROP CONSTRAINT IF EXISTS ck_bien_dacion_pago_estado;
ALTER TABLE contabilidad.bien_dacion_pago
    ADD CONSTRAINT ck_bien_dacion_pago_estado CHECK (
        estado IN ('EN_POSESION', 'TOMADO_EN_PAGO', 'VENDIDO', 'DEVUELTO')
    );

ALTER TABLE contabilidad.bien_dacion_pago
    DROP CONSTRAINT IF EXISTS ck_bien_dacion_pago_monto_amortizado;
ALTER TABLE contabilidad.bien_dacion_pago
    ADD CONSTRAINT ck_bien_dacion_pago_monto_amortizado CHECK (
        monto_amortizado IS NULL OR monto_amortizado > 0
    );

-- Los vendidos con el esquema anterior amortizaron todo el monto de venta.
UPDATE contabilidad.bien_dacion_pago
   SET monto_amortizado = monto_venta
 WHERE estado = 'VENDIDO'
   AND monto_amortizado IS NULL
   AND id_movimiento_kardex IS NOT NULL;

-- Gastos que la empresa le invierte a un bien ya tomado en pago (cambio de
-- nombre, arreglos, pintura...). Cada uno es un EGRESO real de la caja de
-- flujo o de la libreta de bancos, sin recibo, y NO toca el kardex del dueño.
CREATE TABLE IF NOT EXISTS contabilidad.bien_dacion_pago_gasto (
    id                            BIGSERIAL PRIMARY KEY,
    id_bien_dacion_pago           BIGINT NOT NULL
                                  REFERENCES contabilidad.bien_dacion_pago (id) ON DELETE RESTRICT,

    fecha                         DATE NOT NULL,
    concepto                      VARCHAR(255) NOT NULL,
    monto                         NUMERIC(16, 2) NOT NULL,

    id_destino_gasto              INTEGER
                                  REFERENCES parametrica.destino_gasto (id) ON DELETE RESTRICT,
    id_movimiento_caja            BIGINT
                                  REFERENCES contabilidad.movimiento_caja (id) ON DELETE RESTRICT,
    id_libreta_banco              BIGINT
                                  REFERENCES contabilidad.libreta_banco (id) ON DELETE RESTRICT,
    persona_autorizo              JSONB,

    activo                        BOOLEAN NOT NULL DEFAULT TRUE,
    usuario_registro              VARCHAR(100) NOT NULL,
    usuario_ultima_modificacion   VARCHAR(100),
    fecha_registro                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_ultima_modificacion     TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT ck_bien_dacion_pago_gasto_monto CHECK (monto > 0)
);

CREATE INDEX IF NOT EXISTS idx_bien_dacion_pago_gasto_bien
    ON contabilidad.bien_dacion_pago_gasto (id_bien_dacion_pago);

COMMIT;
