-- ============================================================================
-- RESET de promedios, recepciones y valorizaciones de comercio_interno:
-- vacía las tablas en cascada y reinicia ids y secuencias, para poblar data
-- nueva. Script de mantenimiento (sin número de migración), para reusar.
--
-- DESTRUCTIVO e IRREVERSIBLE. Haz un respaldo antes:
--   pg_dump -h <host> -p <puerto> -U <usuario> -d <base> -Fc -f backups/backup_pre_reset_comercio_interno.dump
--
-- Orden (el mismo que se usa a mano): 1) promedios  2) recepciones
-- 3) valorizaciones.
--
-- NO toca parametrica.persona_ci ni parametrica.persona_persona_tipo.
--
-- OJO con CASCADE: además de las tablas de abajo, vacía TODA tabla que tenga
-- una clave foránea hacia ellas. Hoy eso incluye contabilidad.movimiento_kardex
-- (id_valorizacion) y, por dependencia, las tablas de contabilidad que
-- apuntan a movimiento_kardex (recibo, caja de flujo, libreta de bancos...).
-- Ejecuta el PASO 0 antes para ver qué se va a llevar puesto.
--
-- Ejecutar como script completo, sin BEGIN/COMMIT.
-- ============================================================================

-- PASO 0 (opcional, solo lectura): tablas de OTROS módulos que dependen de las
-- que se van a vaciar, con su cantidad de filas actual.
SELECT c.conrelid::regclass AS tabla_que_depende,
       c.confrelid::regclass AS depende_de
FROM pg_constraint c
WHERE c.contype = 'f'
  AND c.confrelid IN (
    'comercio_interno.promedio_mineral'::regclass,
    'comercio_interno.recepcion_mineral'::regclass,
    'comercio_interno.valorizacion_mineral'::regclass
  )
  AND c.connamespace <> 'comercio_interno'::regnamespace;

-- PASO 1: vaciar en cascada, en orden. RESTART IDENTITY reinicia los ids de
-- cada tabla vaciada (y de las que arrastra el cascade).
TRUNCATE TABLE comercio_interno.promedio_mineral       RESTART IDENTITY CASCADE;
TRUNCATE TABLE comercio_interno.recepcion_mineral      RESTART IDENTITY CASCADE;
TRUNCATE TABLE comercio_interno.valorizacion_mineral   RESTART IDENTITY CASCADE;

-- PASO 2: por si acaso, ids de cada tabla en 1 (idempotente; el próximo id
-- será 1 aunque RESTART IDENTITY no hubiera alcanzado alguna secuencia).
SELECT setval(pg_get_serial_sequence('comercio_interno.promedio_mineral', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('comercio_interno.promedio_mineral_detalle', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('comercio_interno.recepcion_mineral', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('comercio_interno.valorizacion_mineral', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('comercio_interno.valorizacion_detalle_mineral', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('comercio_interno.valorizacion_calculo', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('comercio_interno.valorizacion_calculo_aporte', 'id'), 1, false);

-- PASO 3: secuencias de códigos. El próximo código será ICC-0001 / PRM-0001.
ALTER SEQUENCE comercio_interno.seq_recepcion_mineral RESTART WITH 1;
ALTER SEQUENCE comercio_interno.seq_promedio_mineral  RESTART WITH 1;

-- PASO 4: verificación. Tablas en 0 y persona_ci intacta.
SELECT 'recepcion_mineral' AS tabla, count(*) FROM comercio_interno.recepcion_mineral
UNION ALL SELECT 'valorizacion_mineral',         count(*) FROM comercio_interno.valorizacion_mineral
UNION ALL SELECT 'valorizacion_detalle_mineral', count(*) FROM comercio_interno.valorizacion_detalle_mineral
UNION ALL SELECT 'valorizacion_calculo',         count(*) FROM comercio_interno.valorizacion_calculo
UNION ALL SELECT 'valorizacion_calculo_aporte',  count(*) FROM comercio_interno.valorizacion_calculo_aporte
UNION ALL SELECT 'promedio_mineral',             count(*) FROM comercio_interno.promedio_mineral
UNION ALL SELECT 'promedio_mineral_detalle',     count(*) FROM comercio_interno.promedio_mineral_detalle
UNION ALL SELECT 'persona_ci (NO se borra)',     count(*) FROM parametrica.persona_ci;

-- Secuencias del esquema (last_value NULL = sin usar).
SELECT sequencename, last_value
FROM pg_sequences
WHERE schemaname = 'comercio_interno'
ORDER BY sequencename;
