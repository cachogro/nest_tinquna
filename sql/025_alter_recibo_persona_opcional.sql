-- La contraparte física del recibo ("Recibí de" / "Entregué a") pasa a ser
-- opcional: puede ser texto libre (nombres_apellidos) cuando el recibo se
-- entrega a dos personas, o a alguien no registrado en persona_ci. El
-- destino real de cada porción (a quién se le salda la deuda) ya vive en
-- recibo_detalle, así que id_persona en la cabecera es solo informativo.

ALTER TABLE contabilidad.recibo
  ALTER COLUMN id_persona DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS nombres_apellidos VARCHAR(255);
