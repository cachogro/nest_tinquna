import { Auditoria } from 'src/common/entities/auditoria.entity';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TipoEntidadAporte } from './tipo-entidad-aporte.entity';

@Entity({
  name: 'entidad_aporte',
  schema: 'parametrica',
})
export class EntidadAporte extends Auditoria {
  @PrimaryGeneratedColumn({
    type: 'int4',
  })
  id: number;

  @Column({
    name: 'descripcion',
    type: 'varchar',
    length: 120,
    nullable: true,
  })
  descripcion?: string;

  @Column({
    name: 'detalle_aporte',
    type: 'json',
    nullable: true,
  })
  detalleAporte?: Record<string, any>;

  @Column({
    name: 'id_tipo_entidad_aporte',
    type: 'bigint',
    nullable: true,
  })
  idTipoEntidadAporte?: string;

  @ManyToOne(
    () => TipoEntidadAporte,
    (tipoEntidadAporte) => tipoEntidadAporte.entidadesAporte,
    {
      eager: true,
    },
  )
  @JoinColumn({
    name: 'id_tipo_entidad_aporte',
    referencedColumnName: 'id',
  })
  tipoEntidadAporte?: TipoEntidadAporte;
}
