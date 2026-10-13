-- Una línea EFECTIVO ahora puede opcionalmente traer id_persona o
-- id_actor_productivo_minero (nunca los dos): si esa persona/actor tiene
-- kardex abierto, esa línea postea un anticipo (DEBE) en su kardex, además
-- del egreso en caja de flujo. Antes el CHECK exigía que EFECTIVO tuviera
-- ambos en NULL.

ALTER TABLE contabilidad.recibo_detalle
  DROP CONSTRAINT IF EXISTS ck_recibo_detalle_destinatario;

ALTER TABLE contabilidad.recibo_detalle
  ADD CONSTRAINT ck_recibo_detalle_destinatario CHECK (
    (destino = 'PERSONAL' AND id_persona IS NOT NULL AND id_actor_productivo_minero IS NULL) OR
    (destino = 'ACTOR'    AND id_actor_productivo_minero IS NOT NULL AND id_persona IS NULL) OR
    (destino = 'EFECTIVO' AND NOT (id_persona IS NOT NULL AND id_actor_productivo_minero IS NOT NULL))
  );
