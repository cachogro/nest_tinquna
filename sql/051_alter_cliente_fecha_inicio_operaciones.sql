-- parametrica.cliente: fecha de inicio de operaciones con la empresa
-- (mismo campo que ya existe en actor_productivo_minero). Importante para
-- la migración de datos históricos desde el Excel: ahí se debe cargar la
-- fecha real, no la de hoy.
--
-- DEFAULT CURRENT_DATE solo para no romper clientes ya registrados sin este
-- dato; de acá en más el servicio siempre la completa (con la fecha real si
-- se migra, o con la fecha actual si no se envía al crear).

ALTER TABLE parametrica.cliente
  ADD COLUMN IF NOT EXISTS fecha_inicio_operaciones DATE NOT NULL DEFAULT CURRENT_DATE;
