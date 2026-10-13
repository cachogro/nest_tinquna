-- contabilidad.fondo_rendir: qué se hace con el excedente de un fondo
-- RENDIDO_EN_EXCESO (el destinatario puso plata de su bolsillo) y cómo se da
-- por rendido un fondo sin comprobantes.
--
--   1. Reposición: se le devuelve el excedente con un recibo de EGRESO real
--      (caja de flujo o libreta de bancos, igual que la entrega). Queda en
--      monto_repuesto / id_recibo_reposicion / fecha_reposicion.
--   2. Saldo a favor: si no se le devuelve, al entregarle otro fondo el
--      excedente entra en el fondo nuevo como una línea ya justificada
--      (fondo_rendir_detalle.tipo = 'SALDO_FAVOR', id_fondo_origen). En el
--      fondo de origen queda monto_compensado / id_fondo_compensacion.
--   3. Rendido sin comprobantes: una línea tipo 'SIN_COMPROBANTE' por el
--      saldo pendiente deja el fondo en RENDIDO_TOTAL sin cargar facturas.
--
-- En los casos 1 y 2 el fondo de origen pasa a RENDIDO_TOTAL: lo "por
-- reponer" es (justificado - entregado) - monto_repuesto - monto_compensado.

BEGIN;

ALTER TABLE contabilidad.fondo_rendir
    ADD COLUMN IF NOT EXISTS monto_repuesto NUMERIC(16, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS id_recibo_reposicion BIGINT
        REFERENCES contabilidad.recibo (id) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS fecha_reposicion DATE,
    ADD COLUMN IF NOT EXISTS monto_compensado NUMERIC(16, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS id_fondo_compensacion BIGINT
        REFERENCES contabilidad.fondo_rendir (id) ON DELETE RESTRICT;

ALTER TABLE contabilidad.fondo_rendir
    DROP CONSTRAINT IF EXISTS ck_fondo_rendir_reposicion;
ALTER TABLE contabilidad.fondo_rendir
    ADD CONSTRAINT ck_fondo_rendir_reposicion CHECK (
        monto_repuesto >= 0 AND monto_compensado >= 0
    );

ALTER TABLE contabilidad.fondo_rendir_detalle
    ADD COLUMN IF NOT EXISTS tipo VARCHAR(20) NOT NULL DEFAULT 'COMPROBANTE',
    ADD COLUMN IF NOT EXISTS id_fondo_origen BIGINT
        REFERENCES contabilidad.fondo_rendir (id) ON DELETE RESTRICT;

ALTER TABLE contabilidad.fondo_rendir_detalle
    DROP CONSTRAINT IF EXISTS ck_fondo_rendir_detalle_tipo;
ALTER TABLE contabilidad.fondo_rendir_detalle
    ADD CONSTRAINT ck_fondo_rendir_detalle_tipo CHECK (
        tipo IN ('COMPROBANTE', 'SIN_COMPROBANTE', 'SALDO_FAVOR')
    );

COMMIT;
