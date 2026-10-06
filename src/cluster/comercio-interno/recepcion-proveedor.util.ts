import { PersonaCi } from './entities/persona-ci.entity';
import { RecepcionMineral } from './entities/recepcion-mineral/recepcion-mineral.entity';

/**
 * Proveedor de una recepción con forma de persona, para listados y PDFs.
 *
 * Quien deja el mineral puede ser una persona registrada, un actor productivo
 * o un externo del que solo se conoce el nombre. Con persona se devuelve la
 * persona tal cual; en los otros dos casos, un objeto con el nombre guardado
 * en la recepción (`nombresApellidos`) y sin documento ni celular.
 */
export function proveedorDeRecepcion(
  recepcion?: RecepcionMineral | null,
): PersonaCi | undefined {
  if (!recepcion) return undefined;
  if (recepcion.persona) return recepcion.persona;
  const nombre = (recepcion.nombresApellidos ?? '').trim();
  return nombre ? ({ nombres: nombre } as PersonaCi) : undefined;
}
