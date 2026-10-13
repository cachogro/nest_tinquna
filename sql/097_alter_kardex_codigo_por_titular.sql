-- =============================================================================
-- Kardex: el código (KA-001, KS-008...) es del TITULAR, no de cada libro.
-- Antes, al cerrar un kardex el siguiente tomaba un código nuevo de su sigla
-- (KS-008 -> KS-011 -> KS-012...). Ahora el kardex que nace de un cierre
-- conserva el código del anterior y solo avanza su `numero` (N° 1, 2, 3...),
-- que es el contador interno del mismo kardex.
-- =============================================================================

-- El código deja de ser único por sí solo: lo es junto con el número.
DROP INDEX IF EXISTS contabilidad.uq_kardex_codigo;

-- Cada kardex toma el código del N° 1 de su titular.
UPDATE contabilidad.kardex k
   SET codigo = raiz.codigo
  FROM contabilidad.kardex raiz
 WHERE raiz.tipo = k.tipo
   AND raiz.numero = 1
   AND raiz.id_actor_productivo_minero IS NOT DISTINCT FROM k.id_actor_productivo_minero
   AND raiz.id_persona IS NOT DISTINCT FROM k.id_persona
   AND raiz.id_cliente IS NOT DISTINCT FROM k.id_cliente
   AND k.codigo <> raiz.codigo;

CREATE UNIQUE INDEX IF NOT EXISTS uq_kardex_codigo_numero
    ON contabilidad.kardex (codigo, numero);
