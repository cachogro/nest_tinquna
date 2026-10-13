-- El clasificador destino_gasto pasa de la cabecera del recibo a cada línea
-- de recibo_detalle: cada porción del recibo se puede clasificar distinto
-- (ej. una línea PERSONAL puede ser "ANTICIPO A CTA TRANSPORTE" y otra
-- EFECTIVO puede ser "GASTOS VARIOS"). Como consecuencia, cada línea de
-- recibo_detalle genera su propio movimiento_caja (antes se agrupaban en
-- máx. 2: un INGRESO por PERSONAL+ACTOR y un EGRESO por EFECTIVO).

ALTER TABLE contabilidad.recibo
  DROP COLUMN IF EXISTS id_destino_gasto;

ALTER TABLE contabilidad.recibo_detalle
  ADD COLUMN IF NOT EXISTS id_destino_gasto INTEGER
    REFERENCES parametrica.destino_gasto(id) ON DELETE RESTRICT;
