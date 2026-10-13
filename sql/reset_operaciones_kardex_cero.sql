-- =============================================================================
-- Reset de operaciones: vacía comercio_interno y contabilidad, y deja los
-- kardex existentes en cero. Script de mantenimiento (sin número de
-- migración), para reusar.
-- =============================================================================
-- DESTRUCTIVO e IRREVERSIBLE. Haz un respaldo antes:
--   pg_dump -h <host> -p <puerto> -U <usuario> -d <base> -f backups/backup_pre_reset_kardex_cero.sql
--
-- Vacía TODAS las tablas de comercio_interno y contabilidad (recepciones,
-- valorizaciones, promedios, recibos, caja, libreta, traspasos, fondos a
-- rendir, préstamos, boletas, dación en pago, ventas de lote, pagos de
-- valorización, cheques emitidos y los movimientos de kardex) y reinicia ids y
-- correlativos. Los talonarios de cheques no se tocan.
--
-- Los KARDEX no se borran: cada dueño (actor, asociado, personal, cliente)
-- conserva su kardex N° 1 con su código, ABIERTO y con saldo 0. Los kardex
-- siguientes (N° 2, 3...) que nacieron de un cierre se eliminan y el N° 1
-- se reabre.
--
-- NO toca paramétricas (personas, clientes, actores, cajas y cuentas
-- bancarias con sus saldos iniciales, codificaciones...) ni seguridad. Los
-- períodos de caja y de banco se vacían: se vuelven a generar desde el saldo
-- inicial de parametrica.caja / parametrica.cuenta_bancaria.
--
-- Sin CASCADE a propósito: si alguna tabla fuera de esta lista apuntara a
-- estas, el TRUNCATE falla en vez de vaciarla en silencio.
-- =============================================================================

BEGIN;

TRUNCATE TABLE
  comercio_interno.promedio_mineral_detalle,
  comercio_interno.promedio_mineral,
  comercio_interno.valorizacion_calculo_aporte,
  comercio_interno.valorizacion_calculo,
  comercio_interno.valorizacion_detalle_mineral,
  comercio_interno.valorizacion_mineral,
  comercio_interno.recepcion_mineral,
  contabilidad.pago_valorizacion_detalle,
  contabilidad.pago_valorizacion,
  contabilidad.bien_dacion_pago_gasto,
  contabilidad.bien_dacion_pago,
  contabilidad.boleta_pago,
  contabilidad.fondo_rendir_detalle,
  contabilidad.fondo_rendir,
  contabilidad.movimiento_prestamo,
  contabilidad.prestamo_personal,
  contabilidad.venta_lote,
  contabilidad.traspaso,
  contabilidad.cheque,
  contabilidad.recibo_detalle,
  contabilidad.recibo,
  contabilidad.movimiento_kardex,
  contabilidad.movimiento_caja,
  contabilidad.periodo_caja,
  contabilidad.libreta_banco,
  contabilidad.periodo_banco
RESTART IDENTITY;

-- Kardex en cero: fuera los que nacieron de un cierre, y el N° 1 de cada
-- dueño queda abierto y sin saldo.
DELETE FROM contabilidad.kardex WHERE id_kardex_anterior IS NOT NULL;

UPDATE contabilidad.kardex
   SET estado = 'ABIERTO',
       saldo_inicial = 0,
       saldo_actual = 0,
       saldo_cierre = NULL,
       fecha_cierre = NULL,
       cerrado_por = NULL;

-- Secuencias de correlativo que no pertenecen a ninguna tabla.
ALTER SEQUENCE comercio_interno.seq_recepcion_mineral RESTART WITH 1;
ALTER SEQUENCE comercio_interno.seq_promedio_mineral RESTART WITH 1;

-- Correlativo propio de cada codificación de lote.
UPDATE parametrica.codificacion_lote SET ultimo_correlativo = 0;

COMMIT;

-- Verificación: operaciones en 0 y kardex abiertos sin saldo.
SELECT 'recepcion_mineral' AS tabla, count(*) FROM comercio_interno.recepcion_mineral
UNION ALL SELECT 'valorizacion_mineral', count(*) FROM comercio_interno.valorizacion_mineral
UNION ALL SELECT 'promedio_mineral', count(*) FROM comercio_interno.promedio_mineral
UNION ALL SELECT 'recibo', count(*) FROM contabilidad.recibo
UNION ALL SELECT 'movimiento_kardex', count(*) FROM contabilidad.movimiento_kardex
UNION ALL SELECT 'movimiento_caja', count(*) FROM contabilidad.movimiento_caja
UNION ALL SELECT 'libreta_banco', count(*) FROM contabilidad.libreta_banco
UNION ALL SELECT 'traspaso', count(*) FROM contabilidad.traspaso
UNION ALL SELECT 'periodo_caja', count(*) FROM contabilidad.periodo_caja
UNION ALL SELECT 'periodo_banco', count(*) FROM contabilidad.periodo_banco
UNION ALL SELECT 'venta_lote', count(*) FROM contabilidad.venta_lote;

SELECT codigo, tipo, numero, estado, saldo_inicial, saldo_actual
FROM contabilidad.kardex
ORDER BY tipo, numero, id;
