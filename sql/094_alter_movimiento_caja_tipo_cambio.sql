-- =============================================================================
-- Caja de flujo: tipo de cambio de cada movimiento en dólares (Bs. por 1 USD).
-- Es solo informativo: el tipo de cambio varía a diario y se deja constancia
-- del que regía al entrar o salir cada monto. La caja en USD sigue llevando su
-- saldo en dólares; nada se convierte con este dato. NULL en movimientos en Bs.
-- (y en los movimientos en USD anteriores a esta migración).
-- =============================================================================

ALTER TABLE contabilidad.movimiento_caja
  ADD COLUMN IF NOT EXISTS tipo_cambio numeric(12, 4);
