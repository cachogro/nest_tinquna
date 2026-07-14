import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { Auditoria } from 'src/common/entities/auditoria.entity';

@Entity({ name: 'lugar_emision_documento', schema: 'parametrica' })
export class LugarEmisionDocumento extends Auditoria {
  @PrimaryGeneratedColumn()
  id: string;

  @Column({
    length: 5,
  })
  codigo: string;

  @Column({
    length: 20,
  })
  descripcion: string;
}
