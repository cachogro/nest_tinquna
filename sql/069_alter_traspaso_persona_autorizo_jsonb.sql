-- contabilidad.traspaso: agrega quién AUTORIZÓ el traspaso, como snapshot
-- jsonb persona_autorizo = { id, nombres, apellidoPaterno, apellidoMaterno }
-- tomado al registrar. Sin FK, mismo criterio que recibo.persona_autorizo
-- (ver 066_alter_recibo_persona_autorizo_jsonb.sql): el traspaso conserva
-- quién autorizó tal como era ese día aunque la persona se edite después.
-- La validación (autorizado = true y activo = true) está en TraspasoService.
--
-- Nullable para no romper los traspasos ya registrados sin este dato; el
-- servicio lo exige como obligatorio en todo traspaso nuevo.

ALTER TABLE contabilidad.traspaso
    ADD COLUMN IF NOT EXISTS persona_autorizo JSONB;
