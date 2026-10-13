-- contabilidad.libreta_banco: el beneficiario / contraparte del movimiento
-- ("Nombres y apellidos") puede ser, igual que en un recibo, UNA de estas
-- cuatro: persona registrada (id_persona), actor productivo minero
-- (id_actor_productivo_minero), cliente/comprador (id_cliente) o texto libre
-- (nombres_apellidos, que además se completa siempre con el nombre del
-- vinculado para la impresión y el Excel).
--
-- Nullable: los movimientos ya registrados siguen valiendo con id_persona o
-- solo con texto. Que no venga más de una contraparte lo valida el servicio.

ALTER TABLE contabilidad.libreta_banco
  ADD COLUMN IF NOT EXISTS id_actor_productivo_minero BIGINT
      REFERENCES parametrica.actor_productivo_minero (id) ON DELETE RESTRICT;

ALTER TABLE contabilidad.libreta_banco
  ADD COLUMN IF NOT EXISTS id_cliente BIGINT
      REFERENCES parametrica.cliente (id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_libreta_banco_actor_productivo_minero
    ON contabilidad.libreta_banco (id_actor_productivo_minero);

CREATE INDEX IF NOT EXISTS idx_libreta_banco_cliente
    ON contabilidad.libreta_banco (id_cliente);
