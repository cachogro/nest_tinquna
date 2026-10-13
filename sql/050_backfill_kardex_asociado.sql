-- Reclasifica los kardex existentes creados antes de que existiera el tipo
-- ASOCIADO: todo kardex tipo='PERSONAL' cuya persona NO sea personal interno
-- de la empresa (persona_ci.id_actor_productivo_minero <> 1, incluido NULL)
-- pasa a tipo='ASOCIADO'. Los kardex de personal interno real (id=1) quedan
-- intactos como PERSONAL.
--
-- Requiere haber corrido antes 049_alter_kardex_tipo_asociado.sql (agrega
-- el valor ASOCIADO a los CHECK y los índices únicos correspondientes).

-- Vista previa (opcional, para revisar antes de aplicar el UPDATE):
-- SELECT k.id, k.numero, k.tipo, k.id_persona, p.nombres, p.id_actor_productivo_minero
-- FROM contabilidad.kardex k
-- JOIN comercio_interno.persona_ci p ON p.id = k.id_persona
-- WHERE k.tipo = 'PERSONAL'
--   AND p.id_actor_productivo_minero IS DISTINCT FROM 1;

UPDATE contabilidad.kardex k
SET tipo = 'ASOCIADO',
    usuario_ultima_modificacion = 'sistema',
    fecha_ultima_modificacion = NOW()
FROM comercio_interno.persona_ci p
WHERE k.tipo = 'PERSONAL'
  AND k.id_persona = p.id
  AND p.id_actor_productivo_minero IS DISTINCT FROM 1;
