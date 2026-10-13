-- Permiso para descargar en EXCEL los reportes de Contabilidad: caja de
-- flujo, libreta bancaria, kardex, resumen de deudas, libro de recibos, libro
-- de traspasos y rendición de fondos. Se asigna por rol desde
-- Configuraciones > Roles y Permisos.
-- El PDF de esos mismos reportes NO lo necesita: lo descarga cualquier rol
-- que pueda entrar a la pantalla. Tampoco los documentos que se entregan (PDF
-- de un recibo o de una boleta de pago).
-- El administrador lo tiene siempre. Reparto inicial: el operador lo
-- conserva (ya descargaba); los demás roles no.
-- El código debe coincidir con src/security/enums/permisos.ts.

-- Nombre con el que se cargó en una versión previa de esta migración.
UPDATE seguridad.permiso
   SET codigo = 'contabilidad.descargar_excel'
 WHERE codigo = 'contabilidad.descargar_reportes';

INSERT INTO seguridad.permiso (codigo, nombre, descripcion, modulo, usuario_registro) VALUES
    ('contabilidad.descargar_excel', 'Descargar reportes en Excel',
     'Descargar en Excel la caja de flujo, libreta bancaria, kardex, deudas, libros de recibos y traspasos, y rendiciones. El PDF no requiere este permiso.',
     'CONTABILIDAD', 'sistema')
ON CONFLICT (codigo) DO UPDATE
   SET nombre = EXCLUDED.nombre,
       descripcion = EXCLUDED.descripcion;

INSERT INTO seguridad.rol_permiso (id_rol, id_permiso, usuario_registro)
SELECT r.id, p.id, 'sistema'
FROM seguridad.rol r
JOIN seguridad.permiso p ON p.codigo = 'contabilidad.descargar_excel'
WHERE r.codigo = 'ROLE_OPERADOR'
ON CONFLICT (id_rol, id_permiso) DO NOTHING;
