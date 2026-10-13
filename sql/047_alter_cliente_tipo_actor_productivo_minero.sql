-- parametrica.cliente: clasificación del cliente (Empresa, Cooperativa,
-- Comercializadora, etc.), reutilizando el mismo catálogo que ya existe
-- para ActorProductivoMinero (parametrica.tipo_actor_productivo_minero).
-- Es solo una etiqueta descriptiva: no implica que el cliente sea también
-- un actor productivo minero (proveedor).

ALTER TABLE parametrica.cliente
  ADD COLUMN IF NOT EXISTS id_tipo_actor_productivo_minero BIGINT
      REFERENCES parametrica.tipo_actor_productivo_minero (id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_cliente_tipo_actor_productivo_minero
    ON parametrica.cliente (id_tipo_actor_productivo_minero);
