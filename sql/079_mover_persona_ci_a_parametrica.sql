-- =============================================================================
-- 079: mover persona_ci y persona_persona_tipo de comercio_interno a parametrica
-- =============================================================================
-- persona_ci dejó de ser exclusiva de comercio interno: la referencian
-- recepcion_mineral y 10 tablas de contabilidad (kardex, recibo, caja,
-- libreta, préstamos, boletas, fondos a rendir, dación en pago...). Pasa a
-- parametrica, junto a cliente y actor_productivo_minero (las otras
-- contrapartes) y a persona_tipo.
--
-- SET SCHEMA mueve con la tabla sus índices, restricciones y la secuencia
-- propia (comercio_interno.persona_id_seq -> parametrica.persona_id_seq). Las
-- FKs que apuntan a estas tablas siguen válidas: referencian la tabla por OID,
-- no por nombre. El DEFAULT nextval(...) también se resuelve por OID.
--
-- Desplegar junto con el backend que ya usa schema 'parametrica' en
-- PersonaCi / PersonaPersonaTipo.
-- =============================================================================

BEGIN;

ALTER TABLE comercio_interno.persona_ci SET SCHEMA parametrica;
ALTER TABLE comercio_interno.persona_persona_tipo SET SCHEMA parametrica;

COMMIT;

-- Verificación
SELECT table_schema, table_name
  FROM information_schema.tables
 WHERE table_name IN ('persona_ci', 'persona_persona_tipo');

SELECT n.nspname || '.' || t.relname AS tabla, con.conname
  FROM pg_constraint con
  JOIN pg_class t ON t.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
 WHERE con.contype = 'f'
   AND con.confrelid = 'parametrica.persona_ci'::regclass
 ORDER BY 1;

-- Reversa (si hiciera falta):
-- BEGIN;
-- ALTER TABLE parametrica.persona_ci SET SCHEMA comercio_interno;
-- ALTER TABLE parametrica.persona_persona_tipo SET SCHEMA comercio_interno;
-- COMMIT;
