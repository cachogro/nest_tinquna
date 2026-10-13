-- Permisos de pantalla para Configuraciones > Roles y Permisos.
-- Las tablas seguridad.permiso y seguridad.rol_permiso ya existen; acá solo
-- se carga el catálogo y el reparto inicial, que es el acceso que cada rol
-- ya tenía en el front (así nadie gana ni pierde pantallas al aplicarlo).
-- El administrador no lleva filas: el back le da siempre todos los permisos.
-- Los códigos deben coincidir con src/security/enums/permisos.ts.

INSERT INTO seguridad.permiso (codigo, nombre, descripcion, modulo, usuario_registro) VALUES
    ('comercio.recepcion',            'Recepción de minerales',          'Listar y registrar recepciones.',                      'COMERCIO INTERNO', 'sistema'),
    ('comercio.recepcion.gestionar',  'Recepción: editar y cambiar estado', 'Editar una recepción y cambiar su estado.',          'COMERCIO INTERNO', 'sistema'),
    ('comercio.valorizacion',         'Valorización',                    'Valorizar recepciones y registrar su pago.',           'COMERCIO INTERNO', 'sistema'),
    ('comercio.promedios',            'Promedios',                       'Armar y editar promedios de mineral.',                 'COMERCIO INTERNO', 'sistema'),
    ('comercio.ventas_lote',          'Ventas de lote',                  'Registrar y liquidar ventas de lote.',                 'COMERCIO INTERNO', 'sistema'),
    ('comercio.reportes',             'Reportes de comercio interno',    'Reportes de recepción, valorización y promedios.',     'COMERCIO INTERNO', 'sistema'),

    ('contabilidad.recibos',          'Recibos',                         NULL, 'CONTABILIDAD', 'sistema'),
    ('contabilidad.traspasos',        'Traspasos',                       NULL, 'CONTABILIDAD', 'sistema'),
    ('contabilidad.fondo_rendir',     'Fondo a rendir cuentas',          NULL, 'CONTABILIDAD', 'sistema'),
    ('contabilidad.libreta_bancaria', 'Libreta bancaria',                NULL, 'CONTABILIDAD', 'sistema'),
    ('contabilidad.kardex',           'Kardex',                          NULL, 'CONTABILIDAD', 'sistema'),
    ('contabilidad.caja_flujo',       'Caja de flujo',                   NULL, 'CONTABILIDAD', 'sistema'),
    ('contabilidad.prestamos',        'Préstamos al personal',           NULL, 'CONTABILIDAD', 'sistema'),
    ('contabilidad.boletas_pago',     'Boletas de pago',                 NULL, 'CONTABILIDAD', 'sistema'),
    ('contabilidad.reporte_destino',  'Reporte por destino',             NULL, 'CONTABILIDAD', 'sistema'),

    ('config.actores_clientes',       'Actores y clientes',              NULL, 'CONFIGURACIONES', 'sistema'),
    ('config.parametricas',           'Paramétricas',                    NULL, 'CONFIGURACIONES', 'sistema'),
    ('config.usuarios',               'Gestión de usuarios',             'Solo administrador.', 'CONFIGURACIONES', 'sistema'),
    ('config.historial_accesos',      'Historial de accesos',            'Solo administrador.', 'CONFIGURACIONES', 'sistema'),
    ('config.roles_permisos',         'Roles y permisos',                'Solo administrador.', 'CONFIGURACIONES', 'sistema')
ON CONFLICT (codigo) DO NOTHING;

-- Reparto inicial: operador = Contabilidad + Actores y Clientes + Paramétricas.
INSERT INTO seguridad.rol_permiso (id_rol, id_permiso, usuario_registro)
SELECT r.id, p.id, 'sistema'
FROM seguridad.rol r
JOIN seguridad.permiso p
  ON p.codigo LIKE 'contabilidad.%'
  OR p.codigo IN ('config.actores_clientes', 'config.parametricas')
WHERE r.codigo = 'ROLE_OPERADOR'
ON CONFLICT (id_rol, id_permiso) DO NOTHING;

-- Reparto inicial: técnico = Recepción (listar y crear) + Reportes.
INSERT INTO seguridad.rol_permiso (id_rol, id_permiso, usuario_registro)
SELECT r.id, p.id, 'sistema'
FROM seguridad.rol r
JOIN seguridad.permiso p
  ON p.codigo IN ('comercio.recepcion', 'comercio.reportes')
WHERE r.codigo = 'ROLE_TECNICO'
ON CONFLICT (id_rol, id_permiso) DO NOTHING;
