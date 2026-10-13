-- Tabla: contabilidad.kardex
-- Cabecera del "KARDEX DE ANTICIPOS" (hoja 2 del Excel de caja de flujo).
-- Es una cuenta corriente que se abre para:
--   * un ACTOR productivo minero  -> cubre a todas sus personas relacionadas
--   * una PERSONA (persona_ci)     -> cuenta individual de un socio
-- Se cierra a pedido del cliente y se abre uno nuevo (N° 2, N° 3...) que
-- ARRASTRA el saldo / deuda del anterior. El saldo NO se reinicia.
--   saldo_actual = "TOTAL ANTICIPOS POR COBRAR"
--   (DEBE = anticipo entregado sube el saldo; HABER = pago/descuento lo baja)

CREATE TABLE IF NOT EXISTS contabilidad.kardex (
    id                           BIGSERIAL PRIMARY KEY,

    tipo                         VARCHAR(10) NOT NULL,   -- ACTOR | PERSONAL
    id_actor_productivo_minero   BIGINT
                                 REFERENCES parametrica.actor_productivo_minero (id)
                                 ON DELETE RESTRICT,
    id_persona                   BIGINT
                                 REFERENCES comercio_interno.persona_ci (id)
                                 ON DELETE RESTRICT,

    numero                       INTEGER NOT NULL,       -- N° del libro (1, 2, 3...), correlativo por destinatario
    gestion                      INTEGER NOT NULL,       -- año de apertura
    descripcion                  VARCHAR(150),           -- "ANTICIPOS A CTA SACOS DE MINERAL"

    estado                       VARCHAR(10) NOT NULL DEFAULT 'ABIERTO',  -- ABIERTO | CERRADO

    saldo_inicial                NUMERIC(16,2) NOT NULL DEFAULT 0,   -- arrastre del kardex anterior
    saldo_actual                 NUMERIC(16,2) NOT NULL DEFAULT 0,
    saldo_cierre                 NUMERIC(16,2),

    id_kardex_anterior           BIGINT REFERENCES contabilidad.kardex (id),

    fecha_apertura               DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_cierre                 DATE,
    cerrado_por                  VARCHAR(100),

    -- columnas de auditoría (mismo patrón que el resto de la base)
    activo                       BOOLEAN NOT NULL DEFAULT TRUE,
    usuario_registro             VARCHAR(100) NOT NULL,
    usuario_ultima_modificacion  VARCHAR(100),
    fecha_registro               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_ultima_modificacion    TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT ck_kardex_tipo   CHECK (tipo IN ('ACTOR', 'PERSONAL')),
    CONSTRAINT ck_kardex_estado CHECK (estado IN ('ABIERTO', 'CERRADO')),
    CONSTRAINT ck_kardex_destinatario CHECK (
        (tipo = 'ACTOR'    AND id_actor_productivo_minero IS NOT NULL AND id_persona IS NULL) OR
        (tipo = 'PERSONAL' AND id_persona IS NOT NULL AND id_actor_productivo_minero IS NULL)
    )
);

-- Un solo kardex ABIERTO por actor y por persona.
CREATE UNIQUE INDEX IF NOT EXISTS uq_kardex_abierto_actor
    ON contabilidad.kardex (id_actor_productivo_minero)
    WHERE tipo = 'ACTOR' AND estado = 'ABIERTO';

CREATE UNIQUE INDEX IF NOT EXISTS uq_kardex_abierto_persona
    ON contabilidad.kardex (id_persona)
    WHERE tipo = 'PERSONAL' AND estado = 'ABIERTO';

-- Correlativo del N° por destinatario.
CREATE UNIQUE INDEX IF NOT EXISTS uq_kardex_numero_actor
    ON contabilidad.kardex (id_actor_productivo_minero, numero)
    WHERE tipo = 'ACTOR';

CREATE UNIQUE INDEX IF NOT EXISTS uq_kardex_numero_persona
    ON contabilidad.kardex (id_persona, numero)
    WHERE tipo = 'PERSONAL';

CREATE INDEX IF NOT EXISTS idx_kardex_actor
    ON contabilidad.kardex (id_actor_productivo_minero);
CREATE INDEX IF NOT EXISTS idx_kardex_persona
    ON contabilidad.kardex (id_persona);
