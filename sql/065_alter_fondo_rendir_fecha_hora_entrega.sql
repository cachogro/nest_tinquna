-- contabilidad.fondo_rendir: agrega fecha_hora_entrega (fecha Y hora reales
-- en que se registró la entrega del fondo), igual patrón que
-- recibo.fecha_hora_generacion (ver 054_alter_recibo_fecha_hora_generacion_impresion.sql).
-- `fecha` sigue siendo la fecha de negocio (editable, solo día); esta
-- columna la asigna el servidor, no se recibe del front.

ALTER TABLE contabilidad.fondo_rendir
    ADD COLUMN IF NOT EXISTS fecha_hora_entrega TIMESTAMPTZ;

UPDATE contabilidad.fondo_rendir
SET fecha_hora_entrega = fecha_registro
WHERE fecha_hora_entrega IS NULL;

ALTER TABLE contabilidad.fondo_rendir
    ALTER COLUMN fecha_hora_entrega SET NOT NULL;
