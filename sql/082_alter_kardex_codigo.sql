-- contabilidad.kardex: código del kardex.
--
-- Cada kardex lleva un código legible y único:
--
--     K<tipo>-<correlativo>        ej.  KA-001, KP-002
--
--   <tipo>        A = ACTOR, S = ASOCIADO, P = PERSONAL, C = CLIENTE
--   <correlativo> numeración propia de cada sigla (KA, KS, KP, KC), en el
--                 orden en que se crean los kardex. Nunca reinicia.
--
-- Todo kardex nuevo toma el siguiente correlativo de su sigla, tanto el que
-- se abre a mano como el que se genera al cerrar el anterior.
-- Lo genera KardexService (abrir / cerrar); ver kardex-codigo.util.ts.

ALTER TABLE contabilidad.kardex
    ADD COLUMN IF NOT EXISTS codigo VARCHAR(20);

-- Kardex ya existentes: se numeran por tipo, en el orden en que se crearon.
WITH numerados AS (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY tipo ORDER BY id) AS correlativo
    FROM contabilidad.kardex
)
UPDATE contabilidad.kardex k
SET codigo = 'K'
    || CASE k.tipo
           WHEN 'ACTOR'    THEN 'A'
           WHEN 'ASOCIADO' THEN 'S'
           WHEN 'PERSONAL' THEN 'P'
           WHEN 'CLIENTE'  THEN 'C'
       END
    || '-' || LPAD(n.correlativo::text, 3, '0')
FROM numerados n
WHERE k.codigo IS NULL
  AND k.id = n.id;

ALTER TABLE contabilidad.kardex
    ALTER COLUMN codigo SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_kardex_codigo
    ON contabilidad.kardex (codigo);
