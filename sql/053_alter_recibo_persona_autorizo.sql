-- contabilidad.recibo: persona que AUTORIZÓ generar el recibo (distinto de
-- id_persona, que es la contraparte física del recibo). FK propia a
-- persona_ci, sin reutilizar id_persona, porque son roles distintos aunque
-- apunten a la misma tabla. Debe ser una persona con autorizado = true y
-- activa (lo valida ReciboService, no hay CHECK a nivel de tabla porque
-- requeriría una subconsulta).
--
-- Nullable a nivel de base para no romper los recibos ya registrados sin
-- este dato; el servicio lo exige como obligatorio en todo recibo nuevo.

ALTER TABLE contabilidad.recibo
  ADD COLUMN IF NOT EXISTS id_persona_autorizo BIGINT
      REFERENCES comercio_interno.persona_ci (id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_recibo_persona_autorizo
    ON contabilidad.recibo (id_persona_autorizo);
