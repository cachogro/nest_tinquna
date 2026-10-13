-- contabilidad.kardex: baja lógica por inactividad.
--
-- Un kardex ABIERTO pasa a INACTIVO cuando transcurren
-- KARDEX_DIAS_INACTIVIDAD días (.env) desde su referencia de actividad: lo
-- más reciente entre su último movimiento, su apertura y su última
-- reactivación. El estado se calcula al vuelo (KardexActividadService), no
-- se guarda: por eso no hace falta un proceso programado y un cambio en el
-- .env se aplica al instante.
--
-- Un kardex INACTIVO sigue en los listados y en el resumen de deudores con
-- su saldo, pero no admite transacciones nuevas hasta que un operador o
-- admin lo reactive (PATCH /contabilidad/kardex/:id/reactivar), que es lo
-- único que se guarda: cuándo y quién.
--
-- No se usa `activo` para esto: `activo = false` ya significa kardex
-- ANULADO (abierto por error) y lo ocultan los listados.

ALTER TABLE contabilidad.kardex
    ADD COLUMN IF NOT EXISTS fecha_reactivacion TIMESTAMPTZ;

ALTER TABLE contabilidad.kardex
    ADD COLUMN IF NOT EXISTS reactivado_por VARCHAR(100);
