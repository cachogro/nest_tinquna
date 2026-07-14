import { TipoDocumento } from 'src/cluster/parametricas/entities/tipo_documento.entity';
import { Auditoria } from 'src/common/entities/auditoria.entity';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PersonaPersonaTipo } from './persona-persona-tipo.entity';
import { RecepcionMineral } from './recepcion-mineral.entity';

@Entity({ name: 'persona', schema: 'comercio_interno' })
export class PersonaCi extends Auditoria {
  @PrimaryGeneratedColumn({
    type: 'bigint',
  })
  id: string;

  @Column({
    name: 'nombres',
    type: 'varchar',
    length: 100,
  })
  nombres: string;

  @Column({
    name: 'apellido_paterno',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  apellidoPaterno?: string;

  @Column({
    name: 'apellido_materno',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  apellidoMaterno?: string;

  @Column({
    name: 'id_tipo_documento',
    type: 'bigint',
    nullable: true,
  })
  idTipoDocumento?: string;

  @ManyToOne(() => TipoDocumento, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'id_tipo_documento',
  })
  tipoDocumento?: TipoDocumento;

  @Column({
    name: 'numero_documento',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  numeroDocumento?: string;

  @Column({
    name: 'celular',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  celular?: string;

  @Column({
    name: 'observaciones',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  observaciones?: string;

  @OneToMany(() => PersonaPersonaTipo, (personaTipo) => personaTipo.persona, {
   // eager: true,
  })
  personaTipos: PersonaPersonaTipo[];

  @OneToMany(() => RecepcionMineral, (recepcion) => recepcion.persona)
  recepciones: RecepcionMineral[];
}
