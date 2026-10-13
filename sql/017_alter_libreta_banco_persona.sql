-- libreta_banco: vínculo opcional del beneficiario a una persona registrada.
-- Si el beneficiario ya está en comercio_interno.persona_ci se guarda id_persona;
-- si no, id_persona queda NULL y solo vale el texto libre nombres_apellidos.

ALTER TABLE contabilidad.libreta_banco
  ADD COLUMN IF NOT EXISTS id_persona BIGINT
      REFERENCES comercio_interno.persona_ci (id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_libreta_banco_persona
    ON contabilidad.libreta_banco (id_persona);
