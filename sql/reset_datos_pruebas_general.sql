-- =============================================================================
-- Reset general de datos de prueba antes de cargar data real.
-- =============================================================================
-- Vacía TODAS las tablas de comercio_interno y contabilidad, más
-- parametrica.persona_ci, parametrica.persona_persona_tipo,
-- parametrica.cliente (ventas) y parametrica.actor_productivo_minero
-- (compras), y reinicia sus
-- ids y correlativos para que la data real empiece en 1:
--   - ids (secuencias propias de cada tabla): RESTART IDENTITY.
--   - código de operación de recepción (ICC-0001...): seq_recepcion_mineral.
--   - código de promedio (PRM-0001): seq_promedio_mineral.
--   - código de lote (MC-0001, TM-0001...): codificacion_lote.ultimo_correlativo.
--   - recibos, folios de caja/libreta, líneas de kardex, préstamos y boletas
--     se numeran con MAX()+1, así que vuelven a 1 solos al quedar vacías.
--
-- NO toca el resto de paramétricas (codificaciones, minerales, cajas, cuentas
-- bancarias, municipios, tipos de actor, cuentas del plan de cuentas...) ni
-- el esquema seguridad (usuarios, roles).
--
-- Ninguna tabla fuera de este alcance tiene FK hacia estas (verificado), así
-- que CASCADE no alcanza a otras tablas.
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
  contabilidad.bien_dacion_pago,
  contabilidad.boleta_pago,
  contabilidad.fondo_rendir_detalle,
  contabilidad.fondo_rendir,
  contabilidad.movimiento_prestamo,
  contabilidad.prestamo_personal,
  contabilidad.venta_lote,
  contabilidad.traspaso,
  contabilidad.recibo_detalle,
  contabilidad.recibo,
  contabilidad.movimiento_kardex,
  contabilidad.kardex,
  contabilidad.movimiento_caja,
  contabilidad.periodo_caja,
  contabilidad.libreta_banco,
  contabilidad.periodo_banco,
  parametrica.persona_persona_tipo,
  parametrica.persona_ci,
  parametrica.cliente,
  parametrica.actor_productivo_minero
RESTART IDENTITY CASCADE;

-- Secuencias de correlativo que no pertenecen a ninguna tabla.
ALTER SEQUENCE comercio_interno.seq_recepcion_mineral RESTART WITH 1;
ALTER SEQUENCE comercio_interno.seq_promedio_mineral RESTART WITH 1;

-- Correlativo propio de cada codificación de lote.
UPDATE parametrica.codificacion_lote SET ultimo_correlativo = 0;

COMMIT;

-- Verificación: todo en 0.
SELECT 'recepcion_mineral' AS tabla, count(*) FROM comercio_interno.recepcion_mineral
UNION ALL SELECT 'valorizacion_mineral', count(*) FROM comercio_interno.valorizacion_mineral
UNION ALL SELECT 'promedio_mineral', count(*) FROM comercio_interno.promedio_mineral
UNION ALL SELECT 'recibo', count(*) FROM contabilidad.recibo
UNION ALL SELECT 'kardex', count(*) FROM contabilidad.kardex
UNION ALL SELECT 'movimiento_caja', count(*) FROM contabilidad.movimiento_caja
UNION ALL SELECT 'libreta_banco', count(*) FROM contabilidad.libreta_banco
UNION ALL SELECT 'persona_ci', count(*) FROM parametrica.persona_ci
UNION ALL SELECT 'persona_persona_tipo', count(*) FROM parametrica.persona_persona_tipo
UNION ALL SELECT 'cliente', count(*) FROM parametrica.cliente
UNION ALL SELECT 'actor_productivo_minero', count(*) FROM parametrica.actor_productivo_minero;
