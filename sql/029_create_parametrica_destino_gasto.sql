

CREATE TABLE IF NOT EXISTS parametrica.destino_gasto (
    id                           SERIAL PRIMARY KEY,

    nombre                       VARCHAR(80) NOT NULL,
    es_egreso                    BOOLEAN NOT NULL,

    -- columnas de auditoría (mismo patrón que el resto de la base)
    activo                       BOOLEAN NOT NULL DEFAULT TRUE,
    usuario_registro             VARCHAR(100) NOT NULL,
    usuario_ultima_modificacion  VARCHAR(100),
    fecha_registro               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_ultima_modificacion    TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_destino_gasto_nombre
    ON parametrica.destino_gasto (UPPER(nombre));

INSERT INTO parametrica.destino_gasto (nombre, es_egreso, usuario_registro) VALUES
    ('INGRESO DE DEUDA', FALSE, 'sistema'),
    ('INGRESO POR VENTA', FALSE, 'sistema'),
    ('INGRESO POR VENTA DE QUIMBALATE', FALSE, 'sistema'),
    ('VENTA DE COMBUSTIBLE', FALSE, 'sistema'),
    ('VENTA DE MINERALES', FALSE, 'sistema'),

    ('ALIMENTOS PARA MASCOTAS', TRUE, 'sistema'),
    ('ANALISIS DE LABORATORIO', TRUE, 'sistema'),
    ('ANT. TERRENO GARITA SURCO', TRUE, 'sistema'),
    ('ANTICIPO A CTA CARGA DE COMPLEJO DE MINERAL', TRUE, 'sistema'),
    ('ANTICIPO A CTA CHANCADORA', TRUE, 'sistema'),
    ('ANTICIPO A CTA CONCENTRADO', TRUE, 'sistema'),
    ('ANTICIPO A CTA PERSONAL', TRUE, 'sistema'),
    ('ANTICIPO A CTA SACO MINERAL', TRUE, 'sistema'),
    ('ANTICIPO A CTA SACOS DE MINERAL', TRUE, 'sistema'),
    ('ANTICIPO A CTA SUELDO', TRUE, 'sistema'),
    ('ANTICIPO A CTA TRANSPORTE', TRUE, 'sistema'),
    ('ATENCION MEDICA SOCIALES', TRUE, 'sistema'),
    ('CARGUIO Y DESCARGUIO', TRUE, 'sistema'),
    ('COMBUSTIBLE GASOLINA', TRUE, 'sistema'),
    ('COMPRA DE CARGA', TRUE, 'sistema'),
    ('COMPRA DE COMBUSTIBLE', TRUE, 'sistema'),
    ('COMPRA DE MINERAL', TRUE, 'sistema'),
    ('COMPRA DE QUIMBALENTES', TRUE, 'sistema'),
    ('EQUIPO DE COMPUTACION', TRUE, 'sistema'),
    ('GASTOS GENERALES', TRUE, 'sistema'),
    ('GASTOS POR COSTUMBRES CHALLAS', TRUE, 'sistema'),
    ('GASTOS VARIOS', TRUE, 'sistema'),
    ('MANTENIMIENTO Y REPARACION DE VEHICULOS', TRUE, 'sistema'),
    ('MANTENIMIENTO Y REPUESTOS DE VEHICULOS', TRUE, 'sistema'),
    ('MATERIAL DE CONSTRUCCION', TRUE, 'sistema'),
    ('MATERIAL DE ESCRITORIO', TRUE, 'sistema'),
    ('MATERIAL DE LIMPIEZA Y ACCESORIOS', TRUE, 'sistema'),
    ('MATERIAL ELECTRICO', TRUE, 'sistema'),
    ('MUEBLES Y ENSERES', TRUE, 'sistema'),
    ('PAGO DE DEUDA', TRUE, 'sistema'),
    ('PAGO DE SUELDO Y SALARIO EVENTUAL', TRUE, 'sistema'),
    ('PAGO SERV. AGUA', TRUE, 'sistema'),
    ('PASAJES Y VIATICOS', TRUE, 'sistema'),
    ('PEAJES Y PARQUEOS', TRUE, 'sistema'),
    ('PRESTAMO DE DINERO', TRUE, 'sistema'),
    ('ROPA DE TRABAJO Y SEGURIDAD', TRUE, 'sistema'),
    ('SERVICIO DE ALIMENTACION Y REFRIGERIO', TRUE, 'sistema'),
    ('SERVICIO DE PESAJE', TRUE, 'sistema'),
    ('SERVICIO DE PUBLICIDAD Y TRANSPORTE', TRUE, 'sistema'),
    ('SUELDOS Y SALARIOS PERSONAL', TRUE, 'sistema'),
    ('TARJETA PREPAGO', TRUE, 'sistema'),
    ('TRAMITES LEGALES', TRUE, 'sistema'),
    ('TRANSPORTE MAQUINARIA', TRUE, 'sistema')
ON CONFLICT DO NOTHING;
