-- Igual que en el recibo: cuando una línea de kardex se paga por un medio
-- bancario (QR, transferencia, cheque, depósito), se guarda la cuenta
-- bancaria y postea también en la libreta de bancos. Se separa el mismo par
-- de columnas que ya se separó en movimiento_caja:
--   factura_recibo -> documento que respalda la línea (ej. "REC:C-0933",
--                     "DET. ADJ."); antes se mezclaba en nro_comprobante.
--   nro_comprobante -> pasa a ser el n° de comprobante real de la
--                     transacción bancaria (ej. n° de transferencia/QR).
-- No se migran datos existentes: las filas ya cargadas conservan su
-- nro_comprobante actual (documento) tal cual; el cambio de significado
-- aplica hacia adelante.

ALTER TABLE contabilidad.movimiento_kardex
  ADD COLUMN IF NOT EXISTS factura_recibo VARCHAR(30);

ALTER TABLE contabilidad.movimiento_kardex
  ADD COLUMN IF NOT EXISTS id_cuenta_bancaria INTEGER
    REFERENCES parametrica.cuenta_bancaria(id) ON DELETE RESTRICT;

ALTER TABLE contabilidad.libreta_banco
  ADD COLUMN IF NOT EXISTS id_movimiento_kardex BIGINT
    REFERENCES contabilidad.movimiento_kardex(id) ON DELETE RESTRICT;
