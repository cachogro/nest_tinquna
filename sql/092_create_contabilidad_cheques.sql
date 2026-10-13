-- Cheques por cuenta bancaria.
--
-- * Una cuenta puede o no manejar chequera (maneja_cheques). Si no la maneja,
--   un pago con forma CHEQUE sigue funcionando como hasta ahora (N° libre).
-- * talonario_cheque: cada chequera que entrega el banco, con su rango de
--   números. El talonario NO vence por ley; fecha_vencimiento es opcional por
--   si el banco la fija en su contrato.
-- * cheque: una fila por cada número del talonario que ya se usó (emitido,
--   cobrado o anulado). Los que quedan = rango del talonario − filas acá.
--   El cheque emitido sí vence: 30 días para presentarlo al cobro (Código de
--   Comercio, art. 607), revalidable por el girador por el mismo plazo
--   (Reglamento del Cheque del BCB, art. 21).

ALTER TABLE parametrica.cuenta_bancaria
    ADD COLUMN IF NOT EXISTS maneja_cheques BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS contabilidad.talonario_cheque (
    id                           SERIAL PRIMARY KEY,

    id_cuenta_bancaria           INT NOT NULL REFERENCES parametrica.cuenta_bancaria (id),
    serie                        VARCHAR(20),
    numero_inicial               BIGINT NOT NULL,
    numero_final                 BIGINT NOT NULL,
    fecha_recepcion              DATE NOT NULL,
    fecha_vencimiento            DATE,
    observacion                  VARCHAR(255),

    -- columnas de auditoría (mismo patrón que el resto de la base)
    activo                       BOOLEAN NOT NULL DEFAULT TRUE,
    usuario_registro             VARCHAR(100) NOT NULL,
    usuario_ultima_modificacion  VARCHAR(100),
    fecha_registro               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_ultima_modificacion    TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT ck_talonario_cheque_rango CHECK (numero_inicial > 0 AND numero_final >= numero_inicial)
);

CREATE INDEX IF NOT EXISTS ix_talonario_cheque_cuenta
    ON contabilidad.talonario_cheque (id_cuenta_bancaria);

CREATE TABLE IF NOT EXISTS contabilidad.cheque (
    id                           BIGSERIAL PRIMARY KEY,

    id_talonario_cheque          INT NOT NULL REFERENCES contabilidad.talonario_cheque (id),
    numero                       BIGINT NOT NULL,
    estado                       VARCHAR(10) NOT NULL DEFAULT 'EMITIDO',

    fecha_emision                DATE,
    -- Último día para presentarlo al cobro (emisión o revalidación + 30 días).
    fecha_limite_cobro           DATE,
    fecha_revalidacion           DATE,
    fecha_cobro                  DATE,

    monto                        NUMERIC(16, 2),
    beneficiario                 VARCHAR(255),
    concepto                     VARCHAR(500),
    motivo_anulacion             VARCHAR(255),

    -- Movimiento de la libreta de bancos que lo emitió (NULL si se anuló en
    -- blanco, sin llegar a usarse en un pago).
    id_libreta_banco             BIGINT REFERENCES contabilidad.libreta_banco (id),

    activo                       BOOLEAN NOT NULL DEFAULT TRUE,
    usuario_registro             VARCHAR(100) NOT NULL,
    usuario_ultima_modificacion  VARCHAR(100),
    fecha_registro               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_ultima_modificacion    TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT ck_cheque_estado CHECK (estado IN ('EMITIDO', 'COBRADO', 'ANULADO')),
    CONSTRAINT uq_cheque_talonario_numero UNIQUE (id_talonario_cheque, numero)
);

CREATE INDEX IF NOT EXISTS ix_cheque_libreta_banco
    ON contabilidad.cheque (id_libreta_banco);

CREATE INDEX IF NOT EXISTS ix_cheque_estado_limite
    ON contabilidad.cheque (estado, fecha_limite_cobro);
