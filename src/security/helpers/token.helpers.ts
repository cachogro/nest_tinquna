import { createHash } from 'crypto';
import { UnauthorizedException } from '@nestjs/common';

/**
 * Hash determinístico (SHA-256) de un refresh token para almacenarlo en BD.
 * El token en sí ya es de alta entropía (JWT firmado), por lo que un hash
 * determinístico permite buscarlo por igualdad exacta sin exponer el token
 * original si la tabla llegara a filtrarse.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Extrae el token del header `Authorization: Bearer <token>`.
 */
export function extractBearerToken(authorizationHeader?: string): string {
  if (!authorizationHeader) {
    throw new UnauthorizedException('Token no proporcionado');
  }
  const [tipo, token] = authorizationHeader.split(' ');
  if (tipo !== 'Bearer' || !token) {
    throw new UnauthorizedException('Formato de token inválido');
  }
  return token;
}
