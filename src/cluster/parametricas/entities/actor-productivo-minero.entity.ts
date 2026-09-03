import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Auditoria } from 'src/common/entities/auditoria.entity';
import { TipoActorProductivoMinero } from './tipo-actor-productivo-minero.entity';
import { PersonaCi } from 'src/cluster/comercio-interno/entities/persona-ci.entity';
import { Municipio } from './municipio.entity';

export interface SeccionMinaItem {
  id: number;
  descripcion: string;
}

@Entity({
  name: 'actor_productivo_minero',
  schema: 'parametrica',
})
export class ActorProductivoMinero extends Auditoria {
  @PrimaryGeneratedColumn({
    type: 'bigint',
  })
  id: string;

  @Column({
    name: 'id_tipo_actor_productivo_minero',
    type: 'bigint',
  })
  idTipoActorProductivoMinero: string;

  @ManyToOne(
    () => TipoActorProductivoMinero,
    (tipoActorProductivoMinero) =>
      tipoActorProductivoMinero.actoresProductivosMineros,
    {
      eager: true,
    },
  )
  @JoinColumn({
    name: 'id_tipo_actor_productivo_minero',
    referencedColumnName: 'id',
  })
  tipoActorProductivoMinero?: TipoActorProductivoMinero;

  @Column({
    name: 'nombre',
    type: 'varchar',
    length: 150,
  })
  nombre: string;

  @Column({
    name: 'direccion',
    type: 'varchar',
    length: 250,
  })
  direccion: string;

  @Column({
    name: 'telefono',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  telefono?: string;

  @Column({
    name: 'id_municipio',
    type: 'int',
    nullable: true,
  })
  idMunicipio?: number;

  @ManyToOne(() => Municipio, {
    eager: true,
  })
  @JoinColumn({
    name: 'id_municipio',
    referencedColumnName: 'id',
  })
  municipio?: Municipio;

  @Column({
    name: 'nim',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  nim?: string;

  @Column({
    name: 'codigo',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  codigo?: string;

  @Column({
    name: 'secciones_mina',
    type: 'jsonb',
    nullable: true,
  })
  seccionesMina?: SeccionMinaItem[];

  // --- Relación inversa con PersonaCi (opcional) ---
  @OneToMany(() => PersonaCi, (persona) => persona.actorProductivoMinero)
  personas?: PersonaCi[];
}
