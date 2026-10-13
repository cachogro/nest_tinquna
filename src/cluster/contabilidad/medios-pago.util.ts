import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { FormaPago } from 'src/cluster/parametricas/entities/forma-pago.entity';
import { CuentaBancaria } from 'src/cluster/parametricas/entities/cuenta-bancaria.entity';
import { MedioPagoDto } from './dto/medio-pago.dto';

// Formas de pago que implican un medio bancario: exigen cuenta bancaria +
// N° de comprobante.
export const FORMAS_PAGO_BANCARIAS = ['QR', 'TRANSFERENCIA', 'CHEQUE', 'DEPOSITO'];

/**
 * Un medio de pago ya validado. Sin `cuentaBancaria` mueve la caja de flujo;
 * con ella, la libreta de esa cuenta. `formaPago` solo puede faltar en el
 * pago de un solo medio heredado de la cabecera (la forma de pago es
 * opcional ahí).
 */
export interface MedioPagoResuelto {
  formaPago: FormaPago | null;
  cuentaBancaria: CuentaBancaria | null;
  nroComprobante: string | null;
  monto: number;
}

/** Porción de un medio de pago asignada a una línea. */
export interface TramoMedioPago {
  medio: MedioPagoResuelto;
  monto: number;
}

function r2(n: number): number {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

/**
 * Valida los medios de un pago mixto: cada forma de pago existe, las
 * bancarias traen cuenta + N° de comprobante, y la suma es igual al total
 * que se paga. No valida que la cuenta esté aperturada ni su moneda: eso lo
 * hace quien llama, que sabe en qué moneda y cuándo se postea.
 */
export async function resolverMediosPago(
  manager: EntityManager,
  pagos: MedioPagoDto[],
  total: number,
  queSePaga: string,
): Promise<MedioPagoResuelto[]> {
  const medios: MedioPagoResuelto[] = [];
  for (const pago of pagos) {
    const formaPago = await manager.findOne(FormaPago, {
      where: { id: pago.idFormaPago },
    });
    if (!formaPago) {
      throw new NotFoundException('No existe la forma de pago seleccionada.');
    }
    const nroComprobante = pago.nroComprobante?.trim().toUpperCase() || null;
    let cuentaBancaria: CuentaBancaria | null = null;
    if (FORMAS_PAGO_BANCARIAS.includes(formaPago.codigo)) {
      if (!pago.idCuentaBancaria) {
        throw new BadRequestException(
          `La forma de pago ${formaPago.nombre} requiere indicar la cuenta bancaria.`,
        );
      }
      if (!nroComprobante) {
        throw new BadRequestException(
          `La forma de pago ${formaPago.nombre} requiere el N° de comprobante.`,
        );
      }
      cuentaBancaria = await manager.findOne(CuentaBancaria, {
        where: { id: pago.idCuentaBancaria },
      });
      if (!cuentaBancaria) {
        throw new NotFoundException('No existe la cuenta bancaria seleccionada.');
      }
    }
    medios.push({
      formaPago,
      cuentaBancaria,
      nroComprobante,
      monto: r2(pago.monto),
    });
  }

  const suma = r2(medios.reduce((s, m) => s + m.monto, 0));
  if (suma !== r2(total)) {
    throw new BadRequestException(
      `La suma de los medios de pago (${suma}) no coincide con ${queSePaga} (${r2(total)}).`,
    );
  }
  return medios;
}

/**
 * Reparte los medios de pago entre líneas, en orden: cada línea toma del
 * primer medio que todavía tenga saldo y, si no le alcanza, sigue con el
 * siguiente. Devuelve la función que entrega los tramos de cada línea (hay
 * que llamarla una vez por línea, en orden). Con un solo medio, cada línea
 * recibe un único tramo por su monto completo.
 */
export function repartidorMediosPago(
  medios: MedioPagoResuelto[],
): (monto: number) => TramoMedioPago[] {
  const cola = medios.map((medio) => ({ medio, restante: r2(medio.monto) }));
  return (monto: number) => {
    const tramos: TramoMedioPago[] = [];
    let porCubrir = r2(monto);
    for (const item of cola) {
      if (porCubrir <= 0) break;
      if (item.restante <= 0) continue;
      const usa = r2(Math.min(item.restante, porCubrir));
      item.restante = r2(item.restante - usa);
      porCubrir = r2(porCubrir - usa);
      tramos.push({ medio: item.medio, monto: usa });
    }
    return tramos;
  };
}
