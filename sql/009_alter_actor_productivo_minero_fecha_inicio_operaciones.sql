-- Actor productivo minero: fecha de inicio de operaciones con la empresa.
-- La envía el front al registrar; si llega vacía, la aplicación la completa
-- con la fecha actual (hora de Bolivia). El DEFAULT queda como respaldo a
-- nivel de base de datos.

ALTER TABLE parametrica.actor_productivo_minero
  ADD COLUMN IF NOT EXISTS fecha_inicio_operaciones date;

-- Backfill de los actores ya registrados: se asume su fecha de registro.
UPDATE parametrica.actor_productivo_minero
SET fecha_inicio_operaciones = COALESCE(
      fecha_inicio_operaciones,
      fecha_registro::date,
      CURRENT_DATE
    )
WHERE fecha_inicio_operaciones IS NULL;

ALTER TABLE parametrica.actor_productivo_minero
  ALTER COLUMN fecha_inicio_operaciones SET DEFAULT CURRENT_DATE;

ALTER TABLE parametrica.actor_productivo_minero
  ALTER COLUMN fecha_inicio_operaciones SET NOT NULL;
