-- contabilidad.fondo_rendir: agrega el estado RENDIDO_EN_EXCESO.
--
-- Corrige una regla que estaba mal: al justificar, la suma de comprobantes
-- SÍ puede superar el monto entregado (el responsable adelantó plata de su
-- bolsillo) — antes esto se bloqueaba con un error. Cuando pasa, la empresa
-- le debe la diferencia al destinatario ("por reponer"), lo opuesto de
-- PENDIENTE/RENDIDO_PARCIAL (donde el destinatario le debe a la empresa).

ALTER TABLE contabilidad.fondo_rendir
    DROP CONSTRAINT IF EXISTS ck_fondo_rendir_estado;

ALTER TABLE contabilidad.fondo_rendir
    ADD CONSTRAINT ck_fondo_rendir_estado CHECK (
        estado IN ('PENDIENTE', 'RENDIDO_PARCIAL', 'RENDIDO_TOTAL', 'RENDIDO_EN_EXCESO', 'CERRADO_CON_DEUDA')
    );
