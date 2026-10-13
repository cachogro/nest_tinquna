-- contabilidad.recibo: valorización de mineral de la que proviene el recibo
-- cuando este respalda el pago del saldo (Líquido Pagable) al valorizar. El
-- front abre el diálogo de recibo al terminar de valorizar (datos
-- precargados) y envía su id. Mismo esquema que id_recepcion_mineral (056).
--
-- Nullable: los recibos que no vienen de una valorización no lo usan.

ALTER TABLE contabilidad.recibo
  ADD COLUMN IF NOT EXISTS id_valorizacion_mineral BIGINT
      REFERENCES comercio_interno.valorizacion_mineral (id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_recibo_valorizacion_mineral
    ON contabilidad.recibo (id_valorizacion_mineral);

-- Una valorización solo puede tener UN recibo vigente a la vez (BORRADOR o
-- PROCESADO). Uno ANULADO libera la valorización para generar otro.
CREATE UNIQUE INDEX IF NOT EXISTS uq_recibo_valorizacion_mineral_vigente
    ON contabilidad.recibo (id_valorizacion_mineral)
    WHERE id_valorizacion_mineral IS NOT NULL AND estado <> 'ANULADO';
