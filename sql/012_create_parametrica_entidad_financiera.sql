-- Tablas: parametrica.entidad_financiera  +  parametrica.cuenta_bancaria
-- Catálogo de entidades financieras (bancos, cooperativas de ahorro y crédito...)
-- con las que opera la empresa. Cada entidad puede tener VARIAS cuentas
-- (distinto número y/o moneda). Alimentarán los fondos de tipo BANCO del
-- módulo de kardex / caja de flujo.

CREATE TABLE IF NOT EXISTS parametrica.entidad_financiera (
    id                           SERIAL PRIMARY KEY,

    nombre                       VARCHAR(80) NOT NULL,
    sigla                        VARCHAR(20),          -- como aparece en el comprobante (ej. "UNION S.A.")

    -- columnas de auditoría (mismo patrón que el resto del esquema)
    activo                       BOOLEAN NOT NULL DEFAULT TRUE,
    usuario_registro             VARCHAR(100) NOT NULL,
    usuario_ultima_modificacion  VARCHAR(100),
    fecha_registro               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_ultima_modificacion    TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_entidad_financiera_nombre
    ON parametrica.entidad_financiera (UPPER(nombre));

CREATE TABLE IF NOT EXISTS parametrica.cuenta_bancaria (
    id                           SERIAL PRIMARY KEY,

    id_entidad_financiera        INTEGER NOT NULL
                                 REFERENCES parametrica.entidad_financiera (id)
                                 ON DELETE RESTRICT,

    numero_cuenta                VARCHAR(40) NOT NULL,
    moneda                       VARCHAR(3)  NOT NULL DEFAULT 'BOB',
    alias                        VARCHAR(60),          -- nombre corto para elegir en el front

    -- columnas de auditoría (mismo patrón que el resto del esquema)
    activo                       BOOLEAN NOT NULL DEFAULT TRUE,
    usuario_registro             VARCHAR(100) NOT NULL,
    usuario_ultima_modificacion  VARCHAR(100),
    fecha_registro               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_ultima_modificacion    TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT ck_cuenta_bancaria_moneda CHECK (moneda IN ('BOB', 'USD')),
    CONSTRAINT uq_cuenta_bancaria UNIQUE (id_entidad_financiera, numero_cuenta)
);

CREATE INDEX IF NOT EXISTS idx_cuenta_bancaria_entidad
    ON parametrica.cuenta_bancaria (id_entidad_financiera);

-- Entidades financieras que aparecen en la caja de flujo del Excel.
INSERT INTO parametrica.entidad_financiera (nombre, sigla, usuario_registro) VALUES
    ('BANCO UNION',    'UNION S.A.',     'sistema'),
    ('BANCO BCP',      'BCP',            'sistema'),
    ('BANCO SOL',      'SOL S.A.',       'sistema'),
    ('BANCO GANADERO', 'BANCO GANADERO', 'sistema'),
    ('BANCO BNB',      'BNB',            'sistema')
ON CONFLICT DO NOTHING;

-- cuenta_bancaria: sin seed. Los números de cuenta reales los carga la empresa.
