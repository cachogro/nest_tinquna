-- persona_ci: datos laborales del personal de la empresa.
-- Obligatorios (salvo fecha_fin_labores) cuando id_actor_productivo_minero = 1;
-- nulos para proveedores y demás terceros. La validación de obligatoriedad
-- vive en PersonaCiService; a nivel de tabla todas quedan NULL-ables.

ALTER TABLE comercio_interno.persona_ci
  ADD COLUMN IF NOT EXISTS fecha_nacimiento      date,
  ADD COLUMN IF NOT EXISTS fecha_inicio_laboral  date,
  ADD COLUMN IF NOT EXISTS fecha_fin_labores     date,
  ADD COLUMN IF NOT EXISTS direccion             varchar(255);
