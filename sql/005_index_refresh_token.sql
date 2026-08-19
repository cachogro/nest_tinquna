-- Índices de soporte para la nueva lógica de refresh tokens
-- (login, refresh, logout consultan refresh_token por id_usuario y por token_hash).

CREATE INDEX IF NOT EXISTS idx_refresh_token_usuario ON seguridad.refresh_token (id_usuario);
CREATE INDEX IF NOT EXISTS idx_refresh_token_hash ON seguridad.refresh_token (token_hash);
