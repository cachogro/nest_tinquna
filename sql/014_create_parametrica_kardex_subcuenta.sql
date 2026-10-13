-- Tabla: parametrica.kardex_subcuenta
-- Catálogo de subcuentas del kardex por actor ("PRINCIPAL", "COMPRESORA"...).
-- Lista poblada; si el front envía una subcuenta nueva se inserta con
-- origen = 'USUARIO' y se reutiliza. Se guarda siempre en MAYÚSCULAS.

CREATE TABLE IF NOT EXISTS parametrica.kardex_subcuenta (
    id                           SERIAL PRIMARY KEY,

    nombre                       VARCHAR(60) NOT NULL,
    origen                       VARCHAR(10) NOT NULL DEFAULT 'USUARIO',

    -- columnas de auditoría (mismo patrón que el resto del esquema)
    activo                       BOOLEAN NOT NULL DEFAULT TRUE,
    usuario_registro             VARCHAR(100) NOT NULL,
    usuario_ultima_modificacion  VARCHAR(100),
    fecha_registro               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_ultima_modificacion    TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT ck_kardex_subcuenta_origen CHECK (origen IN ('SEED', 'USUARIO'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_kardex_subcuenta_nombre
    ON parametrica.kardex_subcuenta (UPPER(nombre));

INSERT INTO parametrica.kardex_subcuenta (nombre, origen, usuario_registro) VALUES
    ('PRINCIPAL',  'SEED', 'sistema'),
    ('COMPRESORA', 'SEED', 'sistema')
ON CONFLICT DO NOTHING;
