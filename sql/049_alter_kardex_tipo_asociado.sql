-- contabilidad.kardex: divide el antiguo tipo PERSONAL en dos —
--   PERSONAL: exclusivo del personal interno de la empresa
--             (persona.id_actor_productivo_minero = 1).
--   ASOCIADO: persona relacionada a OTRO actor productivo minero, o sin
--             actor (persona suelta). Llevan otro trato (PERSONAL exige
--             datos laborales en persona_ci).
-- Comparten la misma FK id_persona; se distinguen solo por `tipo`. La
-- validación de que la persona corresponda al tipo correcto vive en
-- KardexService (no hay forma simple de expresarla acá sin una FK cruzada
-- a persona_ci.id_actor_productivo_minero).

ALTER TABLE contabilidad.kardex
  DROP CONSTRAINT IF EXISTS ck_kardex_tipo;
ALTER TABLE contabilidad.kardex
  ADD CONSTRAINT ck_kardex_tipo CHECK (tipo IN ('ACTOR', 'ASOCIADO', 'PERSONAL', 'CLIENTE'));

ALTER TABLE contabilidad.kardex
  DROP CONSTRAINT IF EXISTS ck_kardex_destinatario;
ALTER TABLE contabilidad.kardex
  ADD CONSTRAINT ck_kardex_destinatario CHECK (
    (tipo = 'ACTOR'    AND id_actor_productivo_minero IS NOT NULL AND id_persona IS NULL AND id_cliente IS NULL) OR
    (tipo = 'ASOCIADO' AND id_persona IS NOT NULL AND id_actor_productivo_minero IS NULL AND id_cliente IS NULL) OR
    (tipo = 'PERSONAL' AND id_persona IS NOT NULL AND id_actor_productivo_minero IS NULL AND id_cliente IS NULL) OR
    (tipo = 'CLIENTE'  AND id_cliente IS NOT NULL AND id_persona IS NULL AND id_actor_productivo_minero IS NULL)
  );

-- Un solo kardex ABIERTO por persona y por tipo (una persona no puede ser
-- PERSONAL y ASOCIADO al mismo tiempo, lo valida el servicio al abrir).
CREATE UNIQUE INDEX IF NOT EXISTS uq_kardex_abierto_asociado
    ON contabilidad.kardex (id_persona)
    WHERE tipo = 'ASOCIADO' AND estado = 'ABIERTO';

CREATE UNIQUE INDEX IF NOT EXISTS uq_kardex_numero_asociado
    ON contabilidad.kardex (id_persona, numero)
    WHERE tipo = 'ASOCIADO';
