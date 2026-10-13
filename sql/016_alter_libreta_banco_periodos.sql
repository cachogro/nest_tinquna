-- Periodización de la libreta de bancos.
--   * Períodos MENSUALES (mes 1-12) + un período de GESTIÓN (mes NULL) por año.
--   * El saldo de banco NO se reinicia: saldo_final del período N = saldo_inicial
--     del período N+1. La gestión se cierra solo cuando sus 12 meses están cerrados.
--   * El saldo inicial de cada cuenta vive en parametrica.cuenta_bancaria.
--   * Se elimina la fila de apertura de la libreta (es_apertura).

-- 1) Saldo inicial de la cuenta ------------------------------------------------
ALTER TABLE parametrica.cuenta_bancaria
  ADD COLUMN IF NOT EXISTS saldo_inicial       NUMERIC(16,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fecha_saldo_inicial DATE;

-- 2) Períodos de la libreta ---------------------------------------------------
CREATE TABLE IF NOT EXISTS contabilidad.periodo_banco (
    id                           BIGSERIAL PRIMARY KEY,

    id_cuenta_bancaria           INTEGER NOT NULL
                                 REFERENCES parametrica.cuenta_bancaria (id)
                                 ON DELETE RESTRICT,

    tipo                         VARCHAR(10) NOT NULL,                 -- MENSUAL | GESTION
    gestion                      INTEGER NOT NULL,
    mes                          INTEGER,                             -- 1-12 en MENSUAL; NULL en GESTION
    estado                       VARCHAR(10) NOT NULL DEFAULT 'ABIERTO',  -- ABIERTO | CERRADO

    saldo_inicial                NUMERIC(16,2) NOT NULL DEFAULT 0,
    total_debe                   NUMERIC(16,2) NOT NULL DEFAULT 0,
    total_haber                  NUMERIC(16,2) NOT NULL DEFAULT 0,
    saldo_final                  NUMERIC(16,2),                       -- se fija al cerrar
    fecha_cierre                 DATE,
    cerrado_por                  VARCHAR(100),

    activo                       BOOLEAN NOT NULL DEFAULT TRUE,
    usuario_registro             VARCHAR(100) NOT NULL,
    usuario_ultima_modificacion  VARCHAR(100),
    fecha_registro               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_ultima_modificacion    TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT ck_periodo_banco_tipo   CHECK (tipo IN ('MENSUAL', 'GESTION')),
    CONSTRAINT ck_periodo_banco_estado CHECK (estado IN ('ABIERTO', 'CERRADO')),
    CONSTRAINT ck_periodo_banco_mes CHECK (
        (tipo = 'MENSUAL' AND mes BETWEEN 1 AND 12) OR
        (tipo = 'GESTION' AND mes IS NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_periodo_banco_mensual
    ON contabilidad.periodo_banco (id_cuenta_bancaria, gestion, mes)
    WHERE tipo = 'MENSUAL';

CREATE UNIQUE INDEX IF NOT EXISTS uq_periodo_banco_gestion
    ON contabilidad.periodo_banco (id_cuenta_bancaria, gestion)
    WHERE tipo = 'GESTION';

CREATE INDEX IF NOT EXISTS idx_periodo_banco_cuenta
    ON contabilidad.periodo_banco (id_cuenta_bancaria, gestion, mes);

-- 3) Libreta: vincular al período, folio, quitar es_apertura -----------------
DROP INDEX IF EXISTS contabilidad.uq_libreta_banco_apertura;

ALTER TABLE contabilidad.libreta_banco
  DROP COLUMN IF EXISTS es_apertura,
  ADD COLUMN IF NOT EXISTS id_periodo_banco BIGINT
      REFERENCES contabilidad.periodo_banco (id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS folio INTEGER;

-- La tabla está vacía: se puede exigir id_periodo_banco de una vez.
ALTER TABLE contabilidad.libreta_banco
  ALTER COLUMN id_periodo_banco SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_libreta_banco_periodo
    ON contabilidad.libreta_banco (id_periodo_banco);

CREATE UNIQUE INDEX IF NOT EXISTS uq_libreta_banco_folio
    ON contabilidad.libreta_banco (id_cuenta_bancaria, folio)
    WHERE folio IS NOT NULL;
