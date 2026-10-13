-- Tablas: contabilidad.fondo_rendir + contabilidad.fondo_rendir_detalle
--
-- "Fondo a rendir cuentas": se le entrega una plata puntual a una persona o
-- a un actor productivo minero para un propósito concreto (ej. comprar
-- materiales), y esa persona la va justificando de a poco con comprobantes.
-- Distinto del kardex de anticipos (cuenta corriente continua que mezcla
-- todos los anticipos/pagos de alguien): acá cada entrega es su propio
-- seguimiento aislado, con: cuánto se entregó, cuánto se justificó
-- (fondo_rendir_detalle) y cuánto queda pendiente.
--
-- La entrega SIEMPRE respalda un recibo de EGRESO real (contabilidad.recibo,
-- línea EFECTIVO) que mueve la plata de verdad (caja o banco, según el medio
-- de pago) — no se reinventa esa lógica acá. Justificar NO mueve plata: es
-- solo evidencia de en qué se gastó. Cargar el saldo sin justificar al
-- kardex personal del destinatario es una acción aparte y manual del
-- administrador (ver id_movimiento_kardex_cierre), no automática.

CREATE TABLE IF NOT EXISTS contabilidad.fondo_rendir (
    id                            BIGSERIAL PRIMARY KEY,

    id_persona                    BIGINT
                                  REFERENCES comercio_interno.persona_ci (id) ON DELETE RESTRICT,
    id_actor_productivo_minero    BIGINT
                                  REFERENCES parametrica.actor_productivo_minero (id) ON DELETE RESTRICT,

    fecha                         DATE NOT NULL,
    concepto                      VARCHAR(255) NOT NULL,
    monto_entregado               NUMERIC(16, 2) NOT NULL,

    -- Recibo de EGRESO que respalda la entrega real de la plata.
    id_recibo                     BIGINT NOT NULL
                                  REFERENCES contabilidad.recibo (id) ON DELETE RESTRICT,

    id_destino_gasto              INTEGER
                                  REFERENCES parametrica.destino_gasto (id) ON DELETE RESTRICT,

    -- Fecha esperada de rendición, solo informativa (para alertar fondos vencidos).
    fecha_limite                  DATE,

    -- PENDIENTE: sin justificar nada. RENDIDO_PARCIAL: justificado < entregado.
    -- RENDIDO_TOTAL: justificado >= entregado. CERRADO_CON_DEUDA: el admin
    -- cargó el saldo sin justificar al kardex personal del destinatario;
    -- terminal, ya no admite más justificaciones.
    estado                        VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',

    -- Presente solo si estado = CERRADO_CON_DEUDA: la línea DEBE que se
    -- generó en el kardex del destinatario por el saldo sin justificar.
    id_movimiento_kardex_cierre   BIGINT
                                  REFERENCES contabilidad.movimiento_kardex (id) ON DELETE RESTRICT,

    activo                        BOOLEAN NOT NULL DEFAULT TRUE,
    usuario_registro              VARCHAR(100) NOT NULL,
    usuario_ultima_modificacion   VARCHAR(100),
    fecha_registro                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_ultima_modificacion     TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT ck_fondo_rendir_estado CHECK (
        estado IN ('PENDIENTE', 'RENDIDO_PARCIAL', 'RENDIDO_TOTAL', 'CERRADO_CON_DEUDA')
    ),
    CONSTRAINT ck_fondo_rendir_monto CHECK (monto_entregado > 0),
    CONSTRAINT ck_fondo_rendir_destinatario CHECK (
        (id_persona IS NOT NULL AND id_actor_productivo_minero IS NULL) OR
        (id_persona IS NULL AND id_actor_productivo_minero IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_fondo_rendir_persona ON contabilidad.fondo_rendir (id_persona);
CREATE INDEX IF NOT EXISTS idx_fondo_rendir_actor ON contabilidad.fondo_rendir (id_actor_productivo_minero);
CREATE INDEX IF NOT EXISTS idx_fondo_rendir_estado ON contabilidad.fondo_rendir (estado);
CREATE INDEX IF NOT EXISTS idx_fondo_rendir_recibo ON contabilidad.fondo_rendir (id_recibo);

CREATE TABLE IF NOT EXISTS contabilidad.fondo_rendir_detalle (
    id                            BIGSERIAL PRIMARY KEY,
    id_fondo_rendir               BIGINT NOT NULL
                                  REFERENCES contabilidad.fondo_rendir (id) ON DELETE RESTRICT,

    fecha                         DATE NOT NULL,
    concepto                      VARCHAR(255) NOT NULL,
    monto                         NUMERIC(16, 2) NOT NULL,

    -- Evidencia de la compra/gasto justificado.
    nro_comprobante               VARCHAR(30),
    factura_recibo                VARCHAR(30),
    id_destino_gasto              INTEGER
                                  REFERENCES parametrica.destino_gasto (id) ON DELETE RESTRICT,

    activo                        BOOLEAN NOT NULL DEFAULT TRUE,
    usuario_registro              VARCHAR(100) NOT NULL,
    usuario_ultima_modificacion   VARCHAR(100),
    fecha_registro                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_ultima_modificacion     TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT ck_fondo_rendir_detalle_monto CHECK (monto > 0)
);

CREATE INDEX IF NOT EXISTS idx_fondo_rendir_detalle_fondo
    ON contabilidad.fondo_rendir_detalle (id_fondo_rendir);
