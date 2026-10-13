import { BadRequestException } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import { PagoValorizacion } from './entities/pago-valorizacion.entity';
import { BienDacionPago } from './entities/bien-dacion-pago.entity';
import { BienDacionPagoGasto } from './entities/bien-dacion-pago-gasto.entity';
import { PagoValorizacionDetalle } from './entities/pago-valorizacion-detalle.entity';
import { PagoValorizacionMedio } from './entities/pago-valorizacion-medio.entity';
import { FondoRendir } from './entities/fondo-rendir.entity';
import { VentaLote } from './entities/venta-lote.entity';
import { PrestamoPersonal } from './entities/prestamo-personal.entity';
import { MovimientoPrestamo } from './entities/movimiento-prestamo.entity';
import { KardexInteresCuota } from './entities/kardex-interes-cuota.entity';

/**
 * Documento que generó un movimiento de la caja de flujo o de la libreta de
 * bancos. Un movimiento con origen se corrige o se anula DESDE ese documento
 * (que revierte caja, libreta y kardex juntos), nunca desde la bandeja: tocarlo
 * ahí lo dejaría descuadrado con su recibo, su pago o su kardex.
 *
 * La línea de kardex directa (`idMovimientoKardex`) no es un origen de estos:
 * esa sí se edita desde la bandeja, sincronizando la línea.
 */
export type TipoOrigenMovimiento =
  | 'RECIBO'
  | 'TRASPASO'
  | 'PAGO_VALORIZACION'
  | 'BIEN_DACION_VENTA'
  | 'BIEN_DACION_GASTO'
  // Solo en líneas de kardex (asientos sin movimiento de dinero propio):
  | 'BIEN_DACION_AMORTIZACION'
  | 'FONDO_RENDIR'
  | 'VENTA_LOTE'
  | 'PRESTAMO'
  | 'INTERES';

export interface OrigenMovimiento {
  tipo: TipoOrigenMovimiento;
  /** Id del documento de origen (recibo, traspaso, pago, bien o gasto). */
  id: string;
  etiqueta: string;
}

/** Columna con la que los documentos sin FK en el movimiento apuntan a él. */
export type ColumnaOrigenMovimiento = 'idMovimientoCaja' | 'idLibretaBanco';

interface MovimientoConOrigen {
  id: string;
  idRecibo?: string | null;
  idTraspaso?: string | null;
}

const ETIQUETAS: Record<TipoOrigenMovimiento, string> = {
  RECIBO: 'Recibo',
  TRASPASO: 'Traspaso',
  PAGO_VALORIZACION: 'Pago de valorización',
  BIEN_DACION_VENTA: 'Venta de bien en dación de pago',
  BIEN_DACION_GASTO: 'Gasto de bien en dación de pago',
  BIEN_DACION_AMORTIZACION: 'Bien en dación de pago',
  FONDO_RENDIR: 'Fondo a rendir',
  VENTA_LOTE: 'Venta de lote',
  PRESTAMO: 'Préstamo al personal',
  INTERES: 'Intereses por mora',
};

/** Qué lo generó y desde dónde se corrige o anula, por tipo de origen. */
const COMO_SE_GESTIONA: Record<TipoOrigenMovimiento, string> = {
  RECIBO: 'lo generó un recibo: anulá el recibo',
  TRASPASO: 'lo generó un traspaso: modificalo o desactivalo desde el traspaso',
  PAGO_VALORIZACION:
    'lo generó un pago de valorización: anulá el pago desde la valorización',
  BIEN_DACION_VENTA:
    'lo generó la venta de un bien en dación de pago: gestionalo desde el bien',
  BIEN_DACION_GASTO:
    'lo generó un gasto de un bien en dación de pago: anulá el gasto desde el bien',
  BIEN_DACION_AMORTIZACION:
    'lo generó un bien en dación de pago: gestionalo desde el bien',
  FONDO_RENDIR: 'lo generó el cierre de un fondo a rendir: gestionalo desde el fondo',
  VENTA_LOTE:
    'lo generó la liquidación de una venta de lote: revertila desde la venta',
  PRESTAMO: 'lo generó un préstamo al personal: gestionalo desde el préstamo',
  INTERES:
    'lo generó el cargo de intereses por mora: revertilo desde la sección de intereses del kardex',
};

const TAMANO_LOTE = 5000;

/**
 * Origen de cada movimiento, por id de movimiento. El recibo y el traspaso
 * salen de las columnas del propio movimiento; el pago de valorización y los
 * bienes en dación guardan el vínculo de su lado, así que se buscan allá.
 * Los movimientos manuales (o de kardex directo) no aparecen en el mapa.
 */
export async function origenesDeMovimientos(
  manager: EntityManager,
  columna: ColumnaOrigenMovimiento,
  movimientos: MovimientoConOrigen[],
): Promise<Map<string, OrigenMovimiento>> {
  const origenes = new Map<string, OrigenMovimiento>();
  const sinVinculo: string[] = [];

  for (const mov of movimientos) {
    if (mov.idRecibo) {
      origenes.set(String(mov.id), origen('RECIBO', mov.idRecibo));
    } else if (mov.idTraspaso) {
      origenes.set(String(mov.id), origen('TRASPASO', mov.idTraspaso));
    } else {
      sinVinculo.push(String(mov.id));
    }
  }

  for (let i = 0; i < sinVinculo.length; i += TAMANO_LOTE) {
    const ids = sinVinculo.slice(i, i + TAMANO_LOTE);
    const [pagos, medios, bienes, gastos] = await Promise.all([
      manager.find(PagoValorizacion, { where: { [columna]: In(ids) } }),
      // Pago mixto: cada medio guarda su propio movimiento.
      manager.find(PagoValorizacionMedio, { where: { [columna]: In(ids) } }),
      manager.find(BienDacionPago, { where: { [columna]: In(ids) } }),
      manager.find(BienDacionPagoGasto, { where: { [columna]: In(ids) } }),
    ]);
    for (const pago of pagos) {
      origenes.set(String(pago[columna]), origen('PAGO_VALORIZACION', pago.id));
    }
    for (const medio of medios) {
      origenes.set(
        String(medio[columna]),
        origen('PAGO_VALORIZACION', medio.idPagoValorizacion),
      );
    }
    for (const bien of bienes) {
      origenes.set(String(bien[columna]), origen('BIEN_DACION_VENTA', bien.id));
    }
    for (const gasto of gastos) {
      origenes.set(String(gasto[columna]), origen('BIEN_DACION_GASTO', gasto.id));
    }
  }

  return origenes;
}

/**
 * Origen de cada línea de kardex, por id de línea. Las de recibo lo traen en
 * su columna; el resto guarda el vínculo del lado del documento. Las líneas
 * cargadas a mano (desde el kardex o desde la libreta) no aparecen en el mapa.
 */
export async function origenesDeLineasKardex(
  manager: EntityManager,
  lineas: Array<{ id: string; idRecibo?: string | null }>,
): Promise<Map<string, OrigenMovimiento>> {
  const origenes = new Map<string, OrigenMovimiento>();
  const sinVinculo: string[] = [];

  for (const linea of lineas) {
    if (linea.idRecibo) {
      origenes.set(String(linea.id), origen('RECIBO', linea.idRecibo));
    } else {
      sinVinculo.push(String(linea.id));
    }
  }

  for (let i = 0; i < sinVinculo.length; i += TAMANO_LOTE) {
    const ids = sinVinculo.slice(i, i + TAMANO_LOTE);
    const [pagos, bienes, fondos, ventas, prestamos, cuotas, intereses] = await Promise.all([
      manager.find(PagoValorizacionDetalle, { where: { idMovimientoKardex: In(ids) } }),
      manager.find(BienDacionPago, { where: { idMovimientoKardex: In(ids) } }),
      manager.find(FondoRendir, { where: { idMovimientoKardexCierre: In(ids) } }),
      manager.find(VentaLote, { where: { idMovimientoKardexLiquidacion: In(ids) } }),
      manager.find(PrestamoPersonal, { where: { idMovimientoKardex: In(ids) } }),
      manager.find(MovimientoPrestamo, { where: { idMovimientoKardex: In(ids) } }),
      manager.find(KardexInteresCuota, { where: { idMovimientoKardex: In(ids) } }),
    ]);
    for (const pago of pagos) {
      origenes.set(
        String(pago.idMovimientoKardex),
        origen('PAGO_VALORIZACION', pago.idPagoValorizacion),
      );
    }
    for (const bien of bienes) {
      origenes.set(
        String(bien.idMovimientoKardex),
        origen('BIEN_DACION_AMORTIZACION', bien.id),
      );
    }
    for (const fondo of fondos) {
      origenes.set(
        String(fondo.idMovimientoKardexCierre),
        origen('FONDO_RENDIR', fondo.id),
      );
    }
    for (const venta of ventas) {
      origenes.set(
        String(venta.idMovimientoKardexLiquidacion),
        origen('VENTA_LOTE', venta.id),
      );
    }
    for (const cuota of cuotas) {
      origenes.set(String(cuota.idMovimientoKardex), origen('PRESTAMO', cuota.idPrestamo));
    }
    for (const interes of intereses) {
      origenes.set(String(interes.idMovimientoKardex), origen('INTERES', interes.idKardexInteres));
    }
    for (const prestamo of prestamos) {
      origenes.set(String(prestamo.idMovimientoKardex), origen('PRESTAMO', prestamo.id));
    }
  }

  return origenes;
}

export async function origenDeLineaKardex(
  manager: EntityManager,
  linea: { id: string; idRecibo?: string | null },
): Promise<OrigenMovimiento | null> {
  const origenes = await origenesDeLineasKardex(manager, [linea]);
  return origenes.get(String(linea.id)) ?? null;
}

export async function origenDeMovimiento(
  manager: EntityManager,
  columna: ColumnaOrigenMovimiento,
  movimiento: MovimientoConOrigen,
): Promise<OrigenMovimiento | null> {
  const origenes = await origenesDeMovimientos(manager, columna, [movimiento]);
  return origenes.get(String(movimiento.id)) ?? null;
}

/** Corta la operación si el movimiento lo generó otro documento. */
export function validarSinOrigen(
  origenMovimiento: OrigenMovimiento | null,
  bandeja: string,
): void {
  if (!origenMovimiento) {
    return;
  }
  throw new BadRequestException(
    `No se puede hacer desde ${bandeja}: este movimiento ${COMO_SE_GESTIONA[origenMovimiento.tipo]}.`,
  );
}

function origen(tipo: TipoOrigenMovimiento, id: string): OrigenMovimiento {
  return { tipo, id: String(id), etiqueta: ETIQUETAS[tipo] };
}
