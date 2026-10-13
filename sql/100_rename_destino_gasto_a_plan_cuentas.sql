-- "Destino del gasto" pasa a llamarse "Plan de cuentas" (así se lo conoce en
-- contabilidad). Solo cambia el nombre: los datos, ids y relaciones quedan
-- intactos.
--
--   parametrica.destino_gasto            -> parametrica.plan_cuentas
--   <tabla>.id_destino_gasto             -> <tabla>.id_plan_cuentas
--   restricciones, índices y secuencia   -> mismo nombre con plan_cuentas
--   permiso contabilidad.reporte_destino -> contabilidad.reporte_plan_cuentas
--
-- Se puede volver a ejecutar: cada paso se salta si ya está aplicado.

BEGIN;

ALTER TABLE IF EXISTS parametrica.destino_gasto RENAME TO plan_cuentas;
ALTER SEQUENCE IF EXISTS parametrica.destino_gasto_id_seq RENAME TO plan_cuentas_id_seq;

DO $$
DECLARE
  r RECORD;
BEGIN
  -- Columnas id_destino_gasto de todas las tablas que apuntan al catálogo.
  FOR r IN
    SELECT table_schema, table_name
    FROM information_schema.columns
    WHERE column_name = 'id_destino_gasto'
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.%I RENAME COLUMN id_destino_gasto TO id_plan_cuentas',
      r.table_schema, r.table_name
    );
  END LOOP;

  -- Restricciones (PK, FK, CHECK). Renombrar la PK renombra también su índice.
  FOR r IN
    SELECT n.nspname AS esquema, c.relname AS tabla, con.conname AS nombre
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname LIKE '%destino\_gasto%'
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.%I RENAME CONSTRAINT %I TO %I',
      r.esquema, r.tabla, r.nombre, replace(r.nombre, 'destino_gasto', 'plan_cuentas')
    );
  END LOOP;

  -- Índices que no pertenecen a una restricción.
  FOR r IN
    SELECT schemaname AS esquema, indexname AS nombre
    FROM pg_indexes
    WHERE indexname LIKE '%destino\_gasto%'
  LOOP
    EXECUTE format(
      'ALTER INDEX %I.%I RENAME TO %I',
      r.esquema, r.nombre, replace(r.nombre, 'destino_gasto', 'plan_cuentas')
    );
  END LOOP;
END $$;

UPDATE seguridad.permiso
SET codigo = 'contabilidad.reporte_plan_cuentas',
    nombre = 'Reporte por plan de cuentas'
WHERE codigo = 'contabilidad.reporte_destino';

COMMIT;
