-- contabilidad.recibo: recepción de mineral de la que proviene el recibo cuando
-- este respalda el anticipo entregado al registrar la recepción. El front abre
-- el diálogo de recibo desde la recepción (datos precargados) y envía su id.
--
-- Nullable: los recibos que no vienen de una recepción (la mayoría) no lo usan.

ALTER TABLE contabilidad.recibo
  ADD COLUMN IF NOT EXISTS id_recepcion_mineral BIGINT
      REFERENCES comercio_interno.recepcion_mineral (id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_recibo_recepcion_mineral
    ON contabilidad.recibo (id_recepcion_mineral);

-- Una recepción solo puede tener UN recibo de anticipo vigente a la vez
-- (BORRADOR o PROCESADO). Uno ANULADO libera la recepción para generar otro.
CREATE UNIQUE INDEX IF NOT EXISTS uq_recibo_recepcion_mineral_vigente
    ON contabilidad.recibo (id_recepcion_mineral)
    WHERE id_recepcion_mineral IS NOT NULL AND estado <> 'ANULADO';

-- Si ya se había ejecutado la versión anterior de esta migración (columna en
-- recepcion_mineral apuntando al recibo), se descarta: el vínculo vive ahora
-- del lado del recibo.
ALTER TABLE comercio_interno.recepcion_mineral
  DROP COLUMN IF EXISTS id_recibo;
