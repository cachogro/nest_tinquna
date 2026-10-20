import { Auditoria } from 'src/common/entities/auditoria.entity';
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { PersonaPersonaTipo } from '../../comercio-interno/entities/persona-persona-tipo.entity';

// Tipo o rol de persona: solo el nombre, único (sin código ni descripción,
// ver sql/107).
@Entity({ name: 'persona_tipo', schema: 'parametrica' })
export class PersonaTipo extends Auditoria {
  @PrimaryGeneratedColumn({
    type: 'int',
  })
  id: number;

  @Column({
    name: 'nombre',
    type: 'varchar',
    length: 50,
  })
  nombre: string;

  @OneToMany(
    () => PersonaPersonaTipo,
    (personaTipo) => personaTipo.personaTipo,
  )
  personas: PersonaPersonaTipo[];
}
