-- El campo "nombres_apellidos" de movimiento_caja representa la columna
-- "ENTREGA DE FONDOS A:" del Excel de caja de flujo. Se renombra para que
-- coincida con esa etiqueta.

ALTER TABLE contabilidad.movimiento_caja
  RENAME COLUMN nombres_apellidos TO entrega_fondos_a;
