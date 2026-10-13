-- Cuando el recibo se paga/cobra por un medio bancario (QR, TRANSFERENCIA,
-- CHEQUE, DEPOSITO), se puede indicar la cuenta bancaria involucrada y el
-- número de comprobante de esa transacción. Es solo informativo del recibo
-- (para la impresión): NO genera un movimiento en contabilidad.libreta_banco.

ALTER TABLE contabilidad.recibo
  ADD COLUMN IF NOT EXISTS id_cuenta_bancaria INTEGER
      REFERENCES parametrica.cuenta_bancaria (id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS nro_comprobante VARCHAR(30);

CREATE INDEX IF NOT EXISTS idx_recibo_cuenta_bancaria
    ON contabilidad.recibo (id_cuenta_bancaria);
