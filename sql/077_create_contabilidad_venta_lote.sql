-- Venta de un lote (promedio de mineral) a un cliente comprador (ej. Trafigura).
--
-- contabilidad.venta_lote
--   Un lote entero se vende a un solo cliente. Nace ABIERTA sin monto: el
--   comprador suele dar uno o varios anticipos antes de mandar su liquidación
--   final. Cada anticipo/pago es un recibo de INGRESO vinculado por
--   contabilidad.recibo.id_venta_lote, con su línea CLIENTE (HABER en el kardex
--   del cliente) y su movimiento en caja de flujo (efectivo) o en la libreta
--   bancaria (QR, transferencia, cheque, depósito).
--     ABIERTA:   sin liquidación todavía.
--     LIQUIDADA: se registró el monto neto de la liquidación del comprador;
--                genera un DEBE en el kardex del cliente por ese monto (en Bs.),
--                así el kardex queda en 0 cuando se terminó de cobrar.
--     ANULADA:   solo sin cobros vigentes; libera el promedio.
--   Moneda BS (comercio interno) o USD (exportación, con tipo de cambio).
--   total_efectivo_invertido es foto del promedio al crear la venta (el
--   promedio ya no puede cambiar su composición mientras tenga venta vigente).

CREATE TABLE IF NOT EXISTS contabilidad.venta_lote (
    id                              BIGSERIAL PRIMARY KEY,

    id_promedio_mineral             BIGINT NOT NULL
                                    REFERENCES comercio_interno.promedio_mineral (id) ON DELETE RESTRICT,
    codigo_lote                     VARCHAR(30),

    id_cliente                      BIGINT NOT NULL
                                    REFERENCES parametrica.cliente (id) ON DELETE RESTRICT,

    fecha_venta                     DATE NOT NULL,
    moneda                          VARCHAR(3) NOT NULL DEFAULT 'BS',
    tipo_cambio                     NUMERIC(12, 4),
    total_efectivo_invertido        NUMERIC(16, 2) NOT NULL DEFAULT 0,

    -- Liquidación final del comprador (neto), en la moneda de la venta y en Bs.
    monto_venta                     NUMERIC(16, 2),
    monto_venta_bolivianos          NUMERIC(16, 2),
    fecha_liquidacion               DATE,
    id_movimiento_kardex_liquidacion BIGINT
                                    REFERENCES contabilidad.movimiento_kardex (id) ON DELETE RESTRICT,

    estado                          VARCHAR(10) NOT NULL DEFAULT 'ABIERTA',
    observaciones                   VARCHAR(255),

    activo                          BOOLEAN NOT NULL DEFAULT TRUE,
    usuario_registro                VARCHAR(100) NOT NULL,
    usuario_ultima_modificacion     VARCHAR(100),
    fecha_registro                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_ultima_modificacion       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_venta_lote_cliente
    ON contabilidad.venta_lote (id_cliente);
CREATE INDEX IF NOT EXISTS idx_venta_lote_estado
    ON contabilidad.venta_lote (estado);

-- Un lote se vende una sola vez: una venta vigente (no ANULADA) por promedio.
CREATE UNIQUE INDEX IF NOT EXISTS uq_venta_lote_promedio_vigente
    ON contabilidad.venta_lote (id_promedio_mineral)
    WHERE estado <> 'ANULADA';

-- Cobros (anticipos/pagos) de la venta.
ALTER TABLE contabilidad.recibo
  ADD COLUMN IF NOT EXISTS id_venta_lote BIGINT
      REFERENCES contabilidad.venta_lote (id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_recibo_venta_lote
    ON contabilidad.recibo (id_venta_lote);
