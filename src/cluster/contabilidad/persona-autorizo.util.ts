import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { PersonaCi } from 'src/cluster/comercio-interno/entities/persona-ci.entity';

/**
 * Snapshot de quien autorizó un documento contable (columna jsonb
 * `persona_autorizo` de recibo y traspaso). Se toma al registrar y no tiene
 * FK: el documento conserva quién autorizó tal como era ese día, aunque
 * después se edite la persona en persona_ci.
 */
export interface PersonaAutorizo {
  id: string;
  nombres: string;
  apellidoPaterno: string | null;
  apellidoMaterno: string | null;
}

/**
 * Valida que la persona exista, esté activa y tenga `autorizado = true`
 * (misma lista que GET /comercio_interno/persona_ci/autorizadas) y devuelve
 * su snapshot. `documento` solo arma los mensajes: 'el recibo', 'el traspaso'.
 */
export async function resolverPersonaAutorizo(
  personaRepository: Repository<PersonaCi>,
  idPersonaAutorizo: string,
  documento: string,
): Promise<PersonaAutorizo> {
  const persona = await personaRepository.findOne({
    where: { id: String(idPersonaAutorizo) },
  });
  if (!persona) {
    throw new NotFoundException(
      `No se encontró la persona que autorizó ${documento}.`,
    );
  }
  if (!persona.activo) {
    throw new BadRequestException(
      `La persona que autorizó ${documento} está inactiva.`,
    );
  }
  if (!persona.autorizado) {
    throw new BadRequestException(
      `La persona indicada no está autorizada para aprobar ${documento}.`,
    );
  }
  return {
    id: persona.id,
    nombres: persona.nombres,
    apellidoPaterno: persona.apellidoPaterno ?? null,
    apellidoMaterno: persona.apellidoMaterno ?? null,
  };
}
