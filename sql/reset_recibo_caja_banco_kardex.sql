-- ============================================================================
-- RESET COMPLETO de datos transaccionales: recibo, caja de flujo, libreta de
-- bancos y kardex de anticipos (cabeceras incluidas) + aperturas de Caja y
-- de cuentas bancarias.
--
-- NO es una migración de esquema (no lleva número de secuencia como los
-- archivos sql/0xx_*.sql): es un script de mantenimiento para vaciar datos
-- de prueba. Ejecutar solo en un ambiente de desarrollo/pruebas.
--
-- Vacía por completo (TRUNCATE ... RESTART IDENTITY), todas juntas en un
-- solo TRUNCATE porque están enlazadas entre sí por FK (recibo ->
-- movimiento_kardex -> movimiento_caja/libreta_banco, kardex ->
-- movimiento_kardex, etc.) — no hace falta CASCADE porque todas las tablas
-- que se referencian entre sí están incluidas en la lista:
--   contabilidad.recibo_detalle
--   contabilidad.movimiento_caja
--   contabilidad.periodo_caja
--   contabilidad.libreta_banco
--   contabilidad.periodo_banco
--   contabilidad.movimiento_kardex
--   contabilidad.kardex              (cabeceras: TODOS los kardex creados)
--   contabilidad.recibo
--
-- Además deja SIN aperturar (saldo inicial y fecha en 0/NULL) a:
--   parametrica.caja                 (CAJA PRINCIPAL, BS y USD)
--   parametrica.cuenta_bancaria      (todas las cuentas)
--
-- NO se tocan (son catálogos, sobreviven con sus mismos id):
--   parametrica.forma_pago, parametrica.plan_cuentas,
--   parametrica.kardex_subcuenta, parametrica.entidad_financiera,
--   parametrica.persona_ci, parametrica.actor_productivo_minero
-- ============================================================================

BEGIN;

TRUNCATE TABLE
  contabilidad.recibo_detalle,
  contabilidad.movimiento_caja,
  contabilidad.periodo_caja,
  contabilidad.libreta_banco,
  contabilidad.periodo_banco,
  contabilidad.movimiento_kardex,
  contabilidad.kardex,
  contabilidad.recibo
  RESTART IDENTITY;

UPDATE parametrica.caja
SET saldo_inicial_bs = 0,
    fecha_saldo_inicial_bs = NULL,
    saldo_inicial_usd = 0,
    fecha_saldo_inicial_usd = NULL;

UPDATE parametrica.cuenta_bancaria
SET saldo_inicial = 0,
    fecha_saldo_inicial = NULL;

COMMIT;
