-- contabilidad.movimiento_kardex: completa id_forma_pago en las líneas de
-- kardex generadas desde la libreta de bancos antes de que LibretaBancoService
-- lo resolviera. La libreta guarda la forma de pago como texto libre
-- (tipo_transaccion: QR, TRANSFERENCIA...); se busca por código o nombre en
-- parametrica.forma_pago. Solo toca líneas sin forma de pago.

UPDATE contabilidad.movimiento_kardex mk
SET id_forma_pago = fp.id
FROM contabilidad.libreta_banco l
JOIN parametrica.forma_pago fp
  ON UPPER(fp.codigo) = UPPER(TRIM(l.tipo_transaccion))
  OR UPPER(fp.nombre) = UPPER(TRIM(l.tipo_transaccion))
WHERE l.id_movimiento_kardex = mk.id
  AND mk.id_forma_pago IS NULL;
