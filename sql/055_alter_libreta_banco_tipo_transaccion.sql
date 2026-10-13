-- contabilidad.libreta_banco: tipo de transacción bancaria (QR,
-- TRANSFERENCIA, CHEQUE, DEPOSITO, EFECTIVO...). Texto libre, SIN FK: el
-- front manda directamente el nombre elegido de su lista (no se relaciona
-- con parametrica.forma_pago a propósito, para no acoplar esta tabla a ese
-- catálogo). Ahora obligatorio para crear y actualizar un movimiento.

ALTER TABLE contabilidad.libreta_banco
  ADD COLUMN IF NOT EXISTS tipo_transaccion VARCHAR(30);

-- Backfill de movimientos ya existentes: no hay forma de saber el tipo real
-- de cada uno retroactivamente, se deja un placeholder editable a mano.
UPDATE contabilidad.libreta_banco
SET tipo_transaccion = 'NO ESPECIFICADO'
WHERE tipo_transaccion IS NULL;

ALTER TABLE contabilidad.libreta_banco
  ALTER COLUMN tipo_transaccion SET NOT NULL;
