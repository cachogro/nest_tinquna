import { Auditoria } from 'src/common/entities/auditoria.entity';
import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity({
  name: 'tipo_calculo_valorizacion',
  schema: 'parametrica',
})
@Unique('uq_tipo_calculo_valorizacion_descripcion', ['descripcion'])
export class TipoCalculoValorizacion extends Auditoria {
  @PrimaryGeneratedColumn({
    type: 'int4',
  })
  id: number;

  @Column({
    name: 'descripcion',
    type: 'varchar',
    length: 100,
    nullable: false,
  })
  descripcion: string;

  @Column({
    name: 'id_tipo_calculo',
    type: 'smallint',
    nullable: false,
  })
  idTipoCalculo: number;

  @Column({
    name: 'extras',
    type: 'jsonb',
    nullable: true,
  })
  extras?: Record<string, any>;
}
