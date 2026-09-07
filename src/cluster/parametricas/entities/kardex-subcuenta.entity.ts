import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { Auditoria } from 'src/common/entities/auditoria.entity';

@Entity({
  name: 'kardex_subcuenta',
  schema: 'parametrica',
})
export class KardexSubcuenta extends Auditoria {
  @PrimaryGeneratedColumn()
  id: number;

  // Se guarda siempre en MAYÚSCULAS ("PRINCIPAL", "COMPRESORA"...).
  @Column({
    name: 'nombre',
    type: 'varchar',
    length: 60,
  })
  nombre: string;

  // 'SEED' = precargada; 'USUARIO' = creada sobre la marcha desde el front.
  @Column({
    name: 'origen',
    type: 'varchar',
    length: 10,
    default: 'USUARIO',
  })
  origen: string;
}
