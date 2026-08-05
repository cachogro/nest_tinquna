import { Auditoria } from 'src/common/entities/auditoria.entity';
import { Column, Entity, OneToMany, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity({
  name: 'estado_valorizacion',
  schema: 'parametrica',
})
@Unique('uq_estado_valorizacion_nombre', ['nombre'])
export class EstadoValorizacion extends Auditoria {
  @PrimaryGeneratedColumn({
    type: 'int4',
  })
  id: number;

  @Column({
    name: 'nombre',
    type: 'varchar',
    length: 50,
    nullable: false,
  })
  nombre: string;

  @Column({
    name: 'descripcion',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  descripcion?: string;
    
}
