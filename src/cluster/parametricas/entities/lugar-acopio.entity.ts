import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { Auditoria } from 'src/common/entities/auditoria.entity';

@Entity({
  name: 'lugar_acopio',
  schema: 'parametrica',
})
export class LugarAcopio extends Auditoria {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    name: 'descripcion',
    type: 'varchar',
    length: 100,
  })
  descripcion: string;
}
