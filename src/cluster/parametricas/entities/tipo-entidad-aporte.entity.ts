import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { EntidadAporte } from './entidad-aporte.entity';

@Entity({
  name: 'tipo_entidad_aporte',
  schema: 'parametrica',
})
export class TipoEntidadAporte {
  @PrimaryGeneratedColumn({
    type: 'int4',
  })
  id: number;

  @Column({
    name: 'descripcion',
    type: 'varchar',
    length: 80,
    nullable: true,
  })
  descripcion?: string;

  @OneToMany(
    () => EntidadAporte,
    (entidadAporte) => entidadAporte.tipoEntidadAporte,
  )
  entidadesAporte?: EntidadAporte[];
}
