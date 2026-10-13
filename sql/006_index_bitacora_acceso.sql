-- Índices de soporte para el historial de accesos (bitacora_acceso), que
-- empieza a escribirse desde AuthService y se consulta paginado/filtrado
-- por usuario y por rango de fecha desde el panel de administración.

CREATE INDEX IF NOT EXISTS idx_bitacora_acceso_usuario ON seguridad.bitacora_acceso (id_usuario);
CREATE INDEX IF NOT EXISTS idx_bitacora_acceso_fecha ON seguridad.bitacora_acceso (fecha_registro DESC);
