import { Auditoria } from 'src/common/entities/auditoria.entity';
import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

import { PersonaTipo } from '../../parametricas/entities/persona-tipo.entity';
import { PersonaCi } from './persona-ci.entity';

@Entity({
  name: 'persona_persona_tipo',
  schema: 'comercio_interno',
})
export class PersonaPersonaTipo extends Auditoria {
  @PrimaryColumn({
    name: 'id_persona',
    type: 'bigint',
  })
  idPersona: string;

  @PrimaryColumn({
    name: 'id_persona_tipo',
    type: 'integer',
  })
  idPersonaTipo: number;

  @ManyToOne(() => PersonaCi, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'id_persona',
  })
  persona: PersonaCi;

  @ManyToOne(() => PersonaTipo, {
    nullable: false,
    onDelete: 'RESTRICT',
  })

  @JoinColumn({
    name: 'id_persona_tipo',
  })
  personaTipo: PersonaTipo;
}
