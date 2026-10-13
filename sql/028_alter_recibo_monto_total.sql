-- El monto de la cabecera del recibo se renombra a monto_total, para dejar
-- claro que es el total a imprimir; el desglose real vive en
-- contabilidad.recibo_detalle.monto (esa columna no cambia).

ALTER TABLE contabilidad.recibo
  RENAME COLUMN monto TO monto_total;

ALTER TABLE contabilidad.recibo
  RENAME CONSTRAINT ck_recibo_monto_positivo TO ck_recibo_monto_total_positivo;
