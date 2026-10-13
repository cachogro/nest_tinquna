-- Tabla: parametrica.cliente
-- Comprador del mineral ya adquirido a los actores productivos mineros
-- (comercializadora, ingenio comprador, exportadora, etc.). Contraparte del
-- flujo de VENTAS, separada de parametrica.actor_productivo_minero
-- (contraparte de COMPRAS) para no mezclar ambos roles de negocio.

CREATE TABLE IF NOT EXISTS parametrica.cliente (
    id                           BIGSERIAL PRIMARY KEY,

    nombre                       VARCHAR(150) NOT NULL,
    direccion                    VARCHAR(250) NOT NULL,
    telefono                     VARCHAR(30),
    id_municipio                 INTEGER REFERENCES parametrica.municipio (id),
    nit                          VARCHAR(20),
    observaciones                VARCHAR(255),

    -- columnas de auditoría (mismo patrón que el resto de la base)
    activo                       BOOLEAN NOT NULL DEFAULT TRUE,
    usuario_registro             VARCHAR(100) NOT NULL,
    usuario_ultima_modificacion  VARCHAR(100),
    fecha_registro               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_ultima_modificacion    TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_cliente_nombre
    ON parametrica.cliente (UPPER(nombre));

-- ---------------------------------------------------------------------------
-- contabilidad.kardex: tercer tipo de destinatario, CLIENTE (cuenta por
-- cobrar de ventas). Mismo mecanismo DEBE/HABER que ACTOR/PERSONAL.
-- ---------------------------------------------------------------------------

ALTER TABLE contabilidad.kardex
  ADD COLUMN IF NOT EXISTS id_cliente BIGINT
      REFERENCES parametrica.cliente (id) ON DELETE RESTRICT;

ALTER TABLE contabilidad.kardex
  DROP CONSTRAINT IF EXISTS ck_kardex_tipo;
ALTER TABLE contabilidad.kardex
  ADD CONSTRAINT ck_kardex_tipo CHECK (tipo IN ('ACTOR', 'PERSONAL', 'CLIENTE'));

ALTER TABLE contabilidad.kardex
  DROP CONSTRAINT IF EXISTS ck_kardex_destinatario;
ALTER TABLE contabilidad.kardex
  ADD CONSTRAINT ck_kardex_destinatario CHECK (
    (tipo = 'ACTOR'    AND id_actor_productivo_minero IS NOT NULL AND id_persona IS NULL AND id_cliente IS NULL) OR
    (tipo = 'PERSONAL' AND id_persona IS NOT NULL AND id_actor_productivo_minero IS NULL AND id_cliente IS NULL) OR
    (tipo = 'CLIENTE'  AND id_cliente IS NOT NULL AND id_persona IS NULL AND id_actor_productivo_minero IS NULL)
  );

-- Un solo kardex ABIERTO por cliente, y correlativo de N° por cliente
-- (mismo patrón que uq_kardex_abierto_actor / uq_kardex_numero_actor).
CREATE UNIQUE INDEX IF NOT EXISTS uq_kardex_abierto_cliente
    ON contabilidad.kardex (id_cliente)
    WHERE tipo = 'CLIENTE' AND estado = 'ABIERTO';

CREATE UNIQUE INDEX IF NOT EXISTS uq_kardex_numero_cliente
    ON contabilidad.kardex (id_cliente, numero)
    WHERE tipo = 'CLIENTE';

CREATE INDEX IF NOT EXISTS idx_kardex_cliente
    ON contabilidad.kardex (id_cliente);

-- ---------------------------------------------------------------------------
-- contabilidad.recibo: cliente como tercera contraparte física posible
-- ("Recibí de" / "Entregué a"), igual que id_actor_productivo_minero.
-- ---------------------------------------------------------------------------

ALTER TABLE contabilidad.recibo
  ADD COLUMN IF NOT EXISTS id_cliente BIGINT
      REFERENCES parametrica.cliente (id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_recibo_cliente
    ON contabilidad.recibo (id_cliente);

-- ---------------------------------------------------------------------------
-- contabilidad.recibo_detalle: CLIENTE como tercer destino posible de una
-- línea (HABER: cobra una venta a crédito), y EFECTIVO ahora admite
-- opcionalmente id_cliente además de id_persona/id_actor_productivo_minero
-- (a lo sumo uno de los tres).
-- ---------------------------------------------------------------------------

ALTER TABLE contabilidad.recibo_detalle
  ADD COLUMN IF NOT EXISTS id_cliente BIGINT
      REFERENCES parametrica.cliente (id) ON DELETE RESTRICT;

ALTER TABLE contabilidad.recibo_detalle
  DROP CONSTRAINT IF EXISTS ck_recibo_detalle_destino;
ALTER TABLE contabilidad.recibo_detalle
  ADD CONSTRAINT ck_recibo_detalle_destino CHECK (destino IN ('PERSONAL', 'ACTOR', 'CLIENTE', 'EFECTIVO'));

ALTER TABLE contabilidad.recibo_detalle
  DROP CONSTRAINT IF EXISTS ck_recibo_detalle_destinatario;
ALTER TABLE contabilidad.recibo_detalle
  ADD CONSTRAINT ck_recibo_detalle_destinatario CHECK (
    (destino = 'PERSONAL' AND id_persona IS NOT NULL AND id_actor_productivo_minero IS NULL AND id_cliente IS NULL) OR
    (destino = 'ACTOR'    AND id_actor_productivo_minero IS NOT NULL AND id_persona IS NULL AND id_cliente IS NULL) OR
    (destino = 'CLIENTE'  AND id_cliente IS NOT NULL AND id_persona IS NULL AND id_actor_productivo_minero IS NULL) OR
    (destino = 'EFECTIVO' AND (
      CASE WHEN id_persona IS NOT NULL THEN 1 ELSE 0 END +
      CASE WHEN id_actor_productivo_minero IS NOT NULL THEN 1 ELSE 0 END +
      CASE WHEN id_cliente IS NOT NULL THEN 1 ELSE 0 END
    ) <= 1)
  );

CREATE INDEX IF NOT EXISTS idx_recibo_detalle_cliente
    ON contabilidad.recibo_detalle (id_cliente);
