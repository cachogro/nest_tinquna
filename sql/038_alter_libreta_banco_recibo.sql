-- Cuando un recibo indica idCuentaBancaria (el pago se hizo por un medio
-- bancario), la línea EFECTIVO de ese recibo (la única que representa plata
-- que realmente se mueve, a diferencia de las líneas PERSONAL/ACTOR que solo
-- saldan una deuda en el kardex) también postea un movimiento en la libreta
-- de bancos. id_recibo enlaza ese movimiento de vuelta al recibo que lo
-- generó (mismo patrón que movimiento_caja.id_recibo).

ALTER TABLE contabilidad.libreta_banco
  ADD COLUMN IF NOT EXISTS id_recibo BIGINT
    REFERENCES contabilidad.recibo(id) ON DELETE RESTRICT;
