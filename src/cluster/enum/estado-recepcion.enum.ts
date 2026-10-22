/** Estados de la recepción de mineral (parametrica.estado_registro). */
export enum EstadoRecepcion {
  EN_RECEPCION = 1,
  APROBADO = 2,
  RECHAZADO_A_TOL = 3,
  /** Devuelto o retirado. Terminal. */
  CANCELADO = 4,
  /** Se realizó la valorización. Terminal; no es una transición manual. */
  TRANZADO = 5,
  /** En caso de diferencia de leyes. */
  REMUESTREO = 6,
}

/**
 * Transiciones manuales permitidas desde cada estado (PATCH cambiar estado).
 * TRANZADO solo lo pone la valorización al quedar VALORIZADA. CANCELADO,
 * dentro de estas transiciones, solo lo aplica un ADMINISTRADOR.
 */
export const TRANSICIONES_ESTADO_RECEPCION: Record<number, number[]> = {
  [EstadoRecepcion.EN_RECEPCION]: [
    EstadoRecepcion.APROBADO,
    EstadoRecepcion.CANCELADO,
  ],
  [EstadoRecepcion.APROBADO]: [
    EstadoRecepcion.RECHAZADO_A_TOL,
    EstadoRecepcion.REMUESTREO,
    EstadoRecepcion.CANCELADO,
  ],
  [EstadoRecepcion.RECHAZADO_A_TOL]: [
    EstadoRecepcion.REMUESTREO,
    EstadoRecepcion.CANCELADO,
  ],
  [EstadoRecepcion.CANCELADO]: [],
  [EstadoRecepcion.TRANZADO]: [],
  [EstadoRecepcion.REMUESTREO]: [
    EstadoRecepcion.APROBADO,
    EstadoRecepcion.RECHAZADO_A_TOL,
    EstadoRecepcion.CANCELADO,
  ],
};

/** Estados desde los que la recepción puede generar/editar su valorización. */
export const ESTADOS_RECEPCION_VALORIZABLES: number[] = [
  EstadoRecepcion.APROBADO,
  EstadoRecepcion.REMUESTREO,
];
