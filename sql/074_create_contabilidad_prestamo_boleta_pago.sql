-- Préstamos al personal y boletas de pago de sueldo.
--
-- contabilidad.prestamo_personal
--   Préstamo grande a un empleado (ej. compra de una moto), distinto de un
--   anticipo común. La plata sale con un recibo de EGRESO real (caja o banco)
--   y se registra además como DEBE en su kardex PERSONAL, junto con sus
--   demás deudas/anticipos. Como el kardex mezcla todo, cada préstamo lleva
--   aparte su propio sub-libro (movimiento_prestamo) para saber cuánto se
--   debe exactamente de ESE préstamo.
--     VIGENTE:   saldo > 0.
--     CANCELADO: saldo = 0 (se recalcula solo).
--
-- contabilidad.boleta_pago
--   Boleta de pago del sueldo de un empleado por un periodo (fecha_desde a
--   fecha_hasta). Muestra el salario por ley (total ganado, descuentos de
--   ley, líquido pagable) y, aparte, lo descontado internamente para los
--   préstamos. Solo el neto (monto_pagado) sale de caja/banco, con su
--   propio recibo de EGRESO; lo descontado NO sale de ninguna caja: baja el
--   kardex (HABER sin movimiento de dinero) y el sub-libro del préstamo. El
--   kardex no guarda referencia a la boleta: el vínculo vive en
--   movimiento_prestamo (id_boleta_pago + id_movimiento_kardex).
--
-- contabilidad.movimiento_prestamo
--   Sub-libro de cada préstamo: DEBE = monto prestado, HABER = descuento de
--   sueldo o abono con dinero propio, saldo corriente = debe - haber.
--     OTORGAMIENTO:     la entrega del préstamo (línea 1).
--     DESCUENTO_SUELDO: descontado en una boleta de pago (no mueve dinero).
--     ABONO:            el empleado trae dinero de otro lado (recibo INGRESO).

CREATE TABLE IF NOT EXISTS contabilidad.prestamo_personal (
    id                            BIGSERIAL PRIMARY KEY,
    numero                        INT NOT NULL UNIQUE,

    id_persona                    BIGINT NOT NULL
                                  REFERENCES comercio_interno.persona_ci (id) ON DELETE RESTRICT,

    fecha                         DATE NOT NULL,
    descripcion                   VARCHAR(255) NOT NULL,
    monto                         NUMERIC(16, 2) NOT NULL,
    cuota_mensual                 NUMERIC(16, 2) NOT NULL,
    saldo                         NUMERIC(16, 2) NOT NULL,
    estado                        VARCHAR(10) NOT NULL DEFAULT 'VIGENTE',

    -- Recibo de EGRESO con el que salió la plata y su línea DEBE en el kardex.
    id_recibo                     BIGINT NOT NULL
                                  REFERENCES contabilidad.recibo (id) ON DELETE RESTRICT,
    id_movimiento_kardex          BIGINT NOT NULL
                                  REFERENCES contabilidad.movimiento_kardex (id) ON DELETE RESTRICT,

    persona_autorizo              JSONB,
    observaciones                 VARCHAR(500),

    activo                        BOOLEAN NOT NULL DEFAULT TRUE,
    usuario_registro              VARCHAR(100) NOT NULL,
    usuario_ultima_modificacion   VARCHAR(100),
    fecha_registro                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_ultima_modificacion     TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT ck_prestamo_personal_estado CHECK (estado IN ('VIGENTE', 'CANCELADO')),
    CONSTRAINT ck_prestamo_personal_monto CHECK (monto > 0),
    CONSTRAINT ck_prestamo_personal_cuota CHECK (cuota_mensual > 0),
    CONSTRAINT ck_prestamo_personal_saldo CHECK (saldo >= 0 AND saldo <= monto)
);

CREATE INDEX IF NOT EXISTS idx_prestamo_personal_persona
    ON contabilidad.prestamo_personal (id_persona);
CREATE INDEX IF NOT EXISTS idx_prestamo_personal_estado
    ON contabilidad.prestamo_personal (estado);


CREATE TABLE IF NOT EXISTS contabilidad.boleta_pago (
    id                            BIGSERIAL PRIMARY KEY,
    numero                        INT NOT NULL UNIQUE,

    id_persona                    BIGINT NOT NULL
                                  REFERENCES comercio_interno.persona_ci (id) ON DELETE RESTRICT,

    fecha_desde                   DATE NOT NULL,
    fecha_hasta                   DATE NOT NULL,
    fecha_pago                    DATE NOT NULL,
    dias_trabajados               INT,
    concepto                      VARCHAR(255) NOT NULL,

    -- Ingresos (salario_base es copia de persona_ci.salario_mensual o el
    -- monto indicado al emitir; los demás pueden ir en 0).
    salario_base                  NUMERIC(16, 2) NOT NULL,
    bono_antiguedad               NUMERIC(16, 2) NOT NULL DEFAULT 0,
    otros_ingresos                NUMERIC(16, 2) NOT NULL DEFAULT 0,
    total_ganado                  NUMERIC(16, 2) NOT NULL,

    -- Descuentos de ley (pueden ir en 0).
    aporte_laboral                NUMERIC(16, 2) NOT NULL DEFAULT 0,
    rc_iva                        NUMERIC(16, 2) NOT NULL DEFAULT 0,
    otros_descuentos_ley          NUMERIC(16, 2) NOT NULL DEFAULT 0,
    total_descuentos_ley          NUMERIC(16, 2) NOT NULL,

    liquido_pagable               NUMERIC(16, 2) NOT NULL,

    -- Interno: lo descontado para préstamos y lo que realmente se pagó.
    total_descuento_prestamos     NUMERIC(16, 2) NOT NULL DEFAULT 0,
    monto_pagado                  NUMERIC(16, 2) NOT NULL,

    -- Recibo de EGRESO por monto_pagado. NULL si todo el líquido fue a
    -- préstamos (monto_pagado = 0: no sale plata).
    id_recibo                     BIGINT
                                  REFERENCES contabilidad.recibo (id) ON DELETE RESTRICT,

    estado                        VARCHAR(10) NOT NULL DEFAULT 'PAGADA',
    persona_autorizo              JSONB,
    observaciones                 VARCHAR(500),

    activo                        BOOLEAN NOT NULL DEFAULT TRUE,
    usuario_registro              VARCHAR(100) NOT NULL,
    usuario_ultima_modificacion   VARCHAR(100),
    fecha_registro                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_ultima_modificacion     TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT ck_boleta_pago_estado CHECK (estado IN ('PAGADA', 'ANULADA')),
    CONSTRAINT ck_boleta_pago_periodo CHECK (fecha_desde <= fecha_hasta),
    CONSTRAINT ck_boleta_pago_importes CHECK (
        salario_base > 0 AND bono_antiguedad >= 0 AND otros_ingresos >= 0 AND
        aporte_laboral >= 0 AND rc_iva >= 0 AND otros_descuentos_ley >= 0 AND
        liquido_pagable >= 0 AND total_descuento_prestamos >= 0 AND monto_pagado >= 0
    ),
    CONSTRAINT ck_boleta_pago_recibo CHECK (monto_pagado = 0 OR id_recibo IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_boleta_pago_persona
    ON contabilidad.boleta_pago (id_persona);
CREATE INDEX IF NOT EXISTS idx_boleta_pago_fecha_pago
    ON contabilidad.boleta_pago (fecha_pago);


CREATE TABLE IF NOT EXISTS contabilidad.movimiento_prestamo (
    id                            BIGSERIAL PRIMARY KEY,

    id_prestamo                   BIGINT NOT NULL
                                  REFERENCES contabilidad.prestamo_personal (id) ON DELETE RESTRICT,
    numero_linea                  INT NOT NULL,
    fecha                         DATE NOT NULL,
    tipo                          VARCHAR(20) NOT NULL,
    detalle                       VARCHAR(255) NOT NULL,

    debe                          NUMERIC(16, 2) NOT NULL DEFAULT 0,
    haber                         NUMERIC(16, 2) NOT NULL DEFAULT 0,
    saldo                         NUMERIC(16, 2) NOT NULL,

    -- Línea espejo en el kardex PERSONAL.
    id_movimiento_kardex          BIGINT NOT NULL
                                  REFERENCES contabilidad.movimiento_kardex (id) ON DELETE RESTRICT,
    -- OTORGAMIENTO / ABONO: recibo que movió la plata.
    id_recibo                     BIGINT
                                  REFERENCES contabilidad.recibo (id) ON DELETE RESTRICT,
    -- DESCUENTO_SUELDO: boleta en la que se descontó.
    id_boleta_pago                BIGINT
                                  REFERENCES contabilidad.boleta_pago (id) ON DELETE RESTRICT,

    activo                        BOOLEAN NOT NULL DEFAULT TRUE,
    usuario_registro              VARCHAR(100) NOT NULL,
    usuario_ultima_modificacion   VARCHAR(100),
    fecha_registro                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_ultima_modificacion     TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT uq_movimiento_prestamo_linea UNIQUE (id_prestamo, numero_linea),
    CONSTRAINT ck_movimiento_prestamo_tipo CHECK (
        tipo IN ('OTORGAMIENTO', 'DESCUENTO_SUELDO', 'ABONO')
    ),
    CONSTRAINT ck_movimiento_prestamo_importes CHECK (
        debe >= 0 AND haber >= 0 AND (debe > 0) <> (haber > 0)
    ),
    CONSTRAINT ck_movimiento_prestamo_origen CHECK (
        (tipo = 'DESCUENTO_SUELDO' AND id_boleta_pago IS NOT NULL) OR
        (tipo <> 'DESCUENTO_SUELDO' AND id_recibo IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_movimiento_prestamo_prestamo
    ON contabilidad.movimiento_prestamo (id_prestamo);
CREATE INDEX IF NOT EXISTS idx_movimiento_prestamo_boleta
    ON contabilidad.movimiento_prestamo (id_boleta_pago);
