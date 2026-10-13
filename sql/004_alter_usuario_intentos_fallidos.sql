-- Agrega el contador de intentos fallidos de login, usado junto con
-- bloqueado_hasta (ya existía pero no estaba conectado a ninguna lógica)
-- para bloquear temporalmente una cuenta tras varios intentos fallidos.

ALTER TABLE seguridad.usuario
    ADD COLUMN intentos_fallidos INT NOT NULL DEFAULT 0;
