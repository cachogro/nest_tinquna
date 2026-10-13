-- persona_tipo: normalizar los registros existentes a MAYÚSCULAS y sin
-- espacios sobrantes. De aquí en adelante PersonaTipoService guarda siempre
-- codigo / nombre / descripcion en mayúsculas.

UPDATE parametrica.persona_tipo
SET codigo      = UPPER(TRIM(codigo)),
    nombre      = UPPER(TRIM(nombre)),
    descripcion = UPPER(TRIM(descripcion))
WHERE codigo      IS DISTINCT FROM UPPER(TRIM(codigo))
   OR nombre      IS DISTINCT FROM UPPER(TRIM(nombre))
   OR descripcion IS DISTINCT FROM UPPER(TRIM(descripcion));
