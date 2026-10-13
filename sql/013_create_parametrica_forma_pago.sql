-- Tabla: parametrica.forma_pago
-- Catálogo de formas de pago / clases de asiento usadas en la caja de flujo y
-- en los kardex. `afecta_fondo = FALSE` marca los movimientos internos
-- (descuentos, tranzado) que NO mueven caja ni banco.

CREATE TABLE IF NOT EXISTS parametrica.forma_pago (
    id                           SERIAL PRIMARY KEY,

    codigo                       VARCHAR(20) NOT NULL,
    nombre                       VARCHAR(40) NOT NULL,
    afecta_fondo                 BOOLEAN NOT NULL DEFAULT TRUE,

    -- columnas de auditoría (mismo patrón que el resto del esquema)
    activo                       BOOLEAN NOT NULL DEFAULT TRUE,
    usuario_registro             VARCHAR(100) NOT NULL,
    usuario_ultima_modificacion  VARCHAR(100),
    fecha_registro               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_ultima_modificacion    TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_forma_pago_codigo
    ON parametrica.forma_pago (codigo);

INSERT INTO parametrica.forma_pago (codigo, nombre, afecta_fondo, usuario_registro) VALUES
    ('EFECTIVO',      'EFECTIVO',                TRUE,  'sistema'),
    ('QR',            'QR',                      TRUE,  'sistema'),
    ('TRANSFERENCIA', 'TRANSFERENCIA',           TRUE,  'sistema'),
    ('CHEQUE',        'CHEQUE',                  TRUE,  'sistema'),
    ('DEPOSITO',      'DEPOSITO',                TRUE,  'sistema'),
    ('TRANZADO',      'TRANZADO',                FALSE, 'sistema'),
    ('DSCT_LEY',      'DESCUENTO DE LEY',        FALSE, 'sistema'),
    ('DSCT_ANTICIPO', 'DESCUENTO DE ANTICIPO',   FALSE, 'sistema')
ON CONFLICT DO NOTHING;
