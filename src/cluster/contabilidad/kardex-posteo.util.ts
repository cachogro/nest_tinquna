import { NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Kardex } from './entities/kardex.entity';
import { MovimientoKardex } from './entities/movimiento-kardex.entity';

/** Contraparte con kardex propio: exactamente uno de los tres ids. */
export interface ContraparteKardex {
  idPersona?: string | null;
  idActorProductivoMinero?: string | null;
  idCliente?: string | null;
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Kardex ABIERTO de la contraparte (mismo criterio que ReciboService): una
 * persona puede tener kardex PERSONAL o ASOCIADO (comparten `idPersona`),
 * un actor kardex ACTOR y un cliente kardex CLIENTE. Falla si no tiene uno
 * abierto. Devuelve null si no se indicó ninguna contraparte.
 */
export async function buscarKardexAbiertoContraparte(
  manager: EntityManager,
  contraparte: ContraparteKardex,
): Promise<Kardex | null> {
  if (contraparte.idActorProductivoMinero) {
    const kardex = await manager.findOne(Kardex, {
      where: {
        tipo: 'ACTOR',
        idActorProductivoMinero: String(contraparte.idActorProductivoMinero),
        estado: 'ABIERTO',
      },
    });
    if (!kardex) {
      throw new NotFoundException(
        'El actor productivo minero indicado no tiene un kardex abierto. Abrilo primero.',
      );
    }
    return kardex;
  }
  if (contraparte.idCliente) {
    const kardex = await manager.findOne(Kardex, {
      where: { tipo: 'CLIENTE', idCliente: String(contraparte.idCliente), estado: 'ABIERTO' },
    });
    if (!kardex) {
      throw new NotFoundException(
        'El cliente indicado no tiene un kardex abierto. Abrilo primero.',
      );
    }
    return kardex;
  }
  if (contraparte.idPersona) {
    const idPersona = String(contraparte.idPersona);
    const kardex = await manager.findOne(Kardex, {
      where: [
        { tipo: 'PERSONAL', idPersona, estado: 'ABIERTO' },
        { tipo: 'ASOCIADO', idPersona, estado: 'ABIERTO' },
      ],
    });
    if (!kardex) {
      throw new NotFoundException(
        'La persona indicada no tiene un kardex abierto. Abrilo primero.',
      );
    }
    return kardex;
  }
  return null;
}

/** Contraparte titular de un kardex (lo inverso de `buscarKardexAbiertoContraparte`). */
export function contraparteDeKardex(kardex: Kardex): Required<ContraparteKardex> {
  return {
    idPersona: kardex.tipo === 'PERSONAL' || kardex.tipo === 'ASOCIADO' ? kardex.idPersona ?? null : null,
    idActorProductivoMinero: kardex.tipo === 'ACTOR' ? kardex.idActorProductivoMinero ?? null : null,
    idCliente: kardex.tipo === 'CLIENTE' ? kardex.idCliente ?? null : null,
  };
}

export async function siguienteNumeroLineaKardex(
  manager: EntityManager,
  idKardex: string,
): Promise<number> {
  const row = await manager
    .createQueryBuilder(MovimientoKardex, 'm')
    .select('COALESCE(MAX(m.numeroLinea), 0)', 'max')
    .where('m.idKardex = :id', { id: idKardex })
    .getRawOne<{ max: string }>();
  return Number(row?.max ?? 0) + 1;
}

/**
 * Recalcula el saldo corriente de las líneas activas de un kardex y su
 * `saldoActual`. Mismo algoritmo que MovimientoKardexService.recalcularKardex:
 * saldo = saldo_anterior + DEBE - HABER.
 */
export async function recalcularSaldoKardex(
  manager: EntityManager,
  idKardex: string,
): Promise<void> {
  const kardex = await manager.findOne(Kardex, { where: { id: idKardex } });
  if (!kardex) return;

  const movs = await manager.find(MovimientoKardex, {
    where: { idKardex, activo: true },
    order: { numeroLinea: 'ASC', id: 'ASC' },
  });

  let running = r2(Number(kardex.saldoInicial));
  for (const mov of movs) {
    running = r2(running + Number(mov.debe) - Number(mov.haber));
    if (r2(Number(mov.saldo)) !== running) {
      await manager.update(MovimientoKardex, mov.id, { saldo: running });
    }
  }
  await manager.update(Kardex, kardex.id, { saldoActual: running });
}
