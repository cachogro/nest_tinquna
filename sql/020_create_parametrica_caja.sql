-- Tabla: parametrica.caja
-- Catálogo de cajas / fondos de efectivo (ej. "CAJA PRINCIPAL"). A diferencia
-- de cuenta_bancaria, una caja no tiene una sola moneda fija: opera en Bs. y
-- $us. a la vez (tal cual el Excel "CAJA DE FLUJO"), por eso lleva un saldo
-- inicial separado por moneda. El resto (saldo corriente por moneda) lo
-- calcula contabilidad.movimiento_caja / periodo_caja.

CREATE TABLE IF NOT EXISTS parametrica.caja (
    id                           SERIAL PRIMARY KEY,

    nombre                       VARCHAR(80) NOT NULL,   -- ej. "CAJA PRINCIPAL"

    saldo_inicial_bob            NUMERIC(16,2) NOT NULL DEFAULT 0,
    fecha_saldo_inicial_bob      DATE,
    saldo_inicial_usd            NUMERIC(16,2) NOT NULL DEFAULT 0,
    fecha_saldo_inicial_usd      DATE,

    -- columnas de auditoría (mismo patrón que el resto del esquema)
    activo                       BOOLEAN NOT NULL DEFAULT TRUE,
    usuario_registro             VARCHAR(100) NOT NULL,
    usuario_ultima_modificacion  VARCHAR(100),
    fecha_registro               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_ultima_modificacion    TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_caja_nombre
    ON parametrica.caja (UPPER(nombre));

-- Caja principal de la empresa. Saldo de apertura real tomado del Excel
-- "CAJA DE FLUJO JUL-2025" (fila "SALDO DE APERTURA", 2025-06-30).
INSERT INTO parametrica.caja
    (nombre, saldo_inicial_bob, fecha_saldo_inicial_bob, saldo_inicial_usd, usuario_registro)
VALUES
    ('CAJA PRINCIPAL', 1587523.00, '2025-06-30', 0, 'sistema')
ON CONFLICT DO NOTHING;
