-- Por si ya se había corrido 029 con la columna origen incluida (se sacó
-- del diseño por innecesaria, igual que codigo/signo en tipo_movimiento_kardex).

ALTER TABLE parametrica.destino_gasto
  DROP CONSTRAINT IF EXISTS ck_destino_gasto_origen,
  DROP COLUMN IF EXISTS origen;
