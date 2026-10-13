-- comercio_interno.persona_ci: salario mensual del personal de la empresa.
--
-- Obligatorio (se valida en el servicio, no en la base) cuando la persona es
-- personal interno (id_actor_productivo_minero = 1), igual que el resto de
-- los datos laborales; NULL para proveedores y demás. Es el salario VIGENTE:
-- cada boleta de pago guarda su propia copia (boleta_pago.salario_base), así
-- que un aumento posterior no altera las boletas ya emitidas.

ALTER TABLE comercio_interno.persona_ci
    ADD COLUMN IF NOT EXISTS salario_mensual NUMERIC(16, 2);

ALTER TABLE comercio_interno.persona_ci
    DROP CONSTRAINT IF EXISTS ck_persona_ci_salario_mensual;

ALTER TABLE comercio_interno.persona_ci
    ADD CONSTRAINT ck_persona_ci_salario_mensual
    CHECK (salario_mensual IS NULL OR salario_mensual > 0);
