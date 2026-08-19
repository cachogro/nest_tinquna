import { Auditoria } from 'src/common/entities/auditoria.entity';
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { PersonaPersonaTipo } from '../../comercio-interno/entities/persona-persona-tipo.entity';


@Entity({ name: 'persona_tipo', schema: 'parametrica' })
export class PersonaTipo extends Auditoria {
  @PrimaryGeneratedColumn({
    type: 'int',
  })
  id: number;

  @Column({
    name: 'codigo',
    type: 'varchar',
    length: 20,
  })
  codigo: string;

  @Column({
    name: 'nombre',
    type: 'varchar',
    length: 50,
  })
  nombre: string;

  @Column({
    name: 'descripcion',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  descripcion?: string;

  @OneToMany(
    () => PersonaPersonaTipo,
    (personaTipo) => personaTipo.personaTipo,
  )
  personas: PersonaPersonaTipo[];
}