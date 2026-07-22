import { RecepcionMineral } from 'src/cluster/comercio_interno/entities/recepcion_mineral/recepcion-mineral.entity';
import { Auditoria } from 'src/common/entities/auditoria.entity';
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';


@Entity({
  name: 'estado_registro',
  schema: 'parametrica',
})
export class EstadoRegistro extends Auditoria {
  @PrimaryGeneratedColumn({
    type: 'smallint',
  })
  id: number;

  @Column({
    name: 'nombre',
    type: 'varchar',
    length: 30,
    nullable: false,
  })
  nombre: string;

  @Column({
    name: 'descripcion',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  descripcion?: string;

  @OneToMany(
    () => RecepcionMineral,
    (recepcion) => recepcion.estado,
  )
  recepciones: RecepcionMineral[];
}