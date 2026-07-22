import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Auditoria } from 'src/common/entities/auditoria.entity';
import { ActorProductivoMinero } from './actor-productivo-minero.entity';


@Entity({
  name: 'tipo_actor_productivo_minero',
  schema: 'parametrica',
})
export class TipoActorProductivoMinero extends Auditoria {
  @PrimaryGeneratedColumn({
    type: 'bigint',
  })
  id: string;

  @Column({
    name: 'descripcion',
    type: 'varchar',
    length: 100,
  })
  descripcion: string;

  @OneToMany(
    () => ActorProductivoMinero,
    (actorProductivoMinero) =>
      actorProductivoMinero.tipoActorProductivoMinero,
  )
  actoresProductivosMineros?: ActorProductivoMinero[];
}