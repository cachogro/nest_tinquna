-- Se simplifica parametrica.tipo_movimiento_kardex: se quitan codigo y
-- signo (redundante, el sentido del movimiento ya lo definen las columnas
-- debe/haber de movimiento_kardex, no esta tabla).

DROP INDEX IF EXISTS parametrica.uq_tipo_movimiento_kardex_codigo;

ALTER TABLE parametrica.tipo_movimiento_kardex
  DROP CONSTRAINT IF EXISTS ck_tipo_movimiento_kardex_signo,
  DROP COLUMN IF EXISTS codigo,
  DROP COLUMN IF EXISTS signo;
