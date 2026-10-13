-- persona_ci: bandera de autorización manual. Se administra directo en la
-- base de datos (no hay endpoint para registrarla/actualizarla desde la
-- API); sirve de base para futuras autorizaciones. Solo lectura vía API
-- (GET /comercio_interno/persona_ci/autorizadas, que además filtra activo).

ALTER TABLE comercio_interno.persona_ci
  ADD COLUMN IF NOT EXISTS autorizado BOOLEAN NOT NULL DEFAULT FALSE;
