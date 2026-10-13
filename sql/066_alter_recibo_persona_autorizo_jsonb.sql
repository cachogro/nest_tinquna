-- contabilidad.recibo: reemplaza la FK id_persona_autorizo (ver
-- 053_alter_recibo_persona_autorizo.sql) por un snapshot jsonb
-- persona_autorizo = { id, nombres, apellidoPaterno, apellidoMaterno }
-- tomado al generar el recibo. Sin FK: el recibo conserva quién autorizó
-- tal como era ese día, aunque la persona cambie después. La validación
-- (autorizado = true y activo = true) sigue en ReciboService.

BEGIN;

ALTER TABLE contabilidad.recibo
    ADD COLUMN IF NOT EXISTS persona_autorizo JSONB;

-- Backfill de los recibos existentes desde persona_ci.
UPDATE contabilidad.recibo r
SET persona_autorizo = jsonb_build_object(
        'id', p.id::text,
        'nombres', p.nombres,
        'apellidoPaterno', p.apellido_paterno,
        'apellidoMaterno', p.apellido_materno
    )
FROM comercio_interno.persona_ci p
WHERE p.id = r.id_persona_autorizo
  AND r.persona_autorizo IS NULL;

DROP INDEX IF EXISTS contabilidad.idx_recibo_persona_autorizo;

ALTER TABLE contabilidad.recibo
    DROP COLUMN IF EXISTS id_persona_autorizo;

COMMIT;
