import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { Auditoria } from 'src/common/entities/auditoria.entity';

@Entity({ name: 'tipo_documento', schema: 'parametrica' })
export class TipoDocumento extends Auditoria {
  @PrimaryGeneratedColumn()
  id: string;

  @Column({
    length: 10,
  })
  codigo: string;

  @Column({
    length: 50,
  })
  descripcion: string;
}
