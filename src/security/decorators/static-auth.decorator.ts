import { applyDecorators, UseGuards } from "@nestjs/common";
import { StaticTokenGuard } from "../guards/static-token.guard";

/**
 * Decorador personalizado para autenticación con token estático
 * Uso: @StaticAuth() en lugar de @Auth()
 *
 * Este decorador valida que la petición incluya un token estático
 * en el header 'x-static-token'
 *
 * Ejemplo de uso en un endpoint:
 * @Get('auxiliar_rc/:numeroNit/:fechaInicio/:fechaFin')
 * @StaticAuth()
 * public async getAuxiliarRC(...) { ... }
 *
 * Ejemplo de petición:
 * curl -H "x-static-token: SINACOM_AUXILIAR_RC_2024_SECRET_TOKEN" \
 *   http://localhost:3000/registro_compra_m02/auxiliar_rc/123/2024-01-01/2024-12-31
 */
export function StaticAuth() {
  return applyDecorators(UseGuards(StaticTokenGuard));
}
