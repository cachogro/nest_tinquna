import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { Auditoria } from 'src/common/entities/auditoria.entity';

@Entity({
  name: 'forma_pago',
  schema: 'parametrica',
})
export class FormaPago extends Auditoria {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    name: 'codigo',
    type: 'varchar',
    length: 20,
  })
  codigo: string;

  @Column({
    name: 'nombre',
    type: 'varchar',
    length: 40,
  })
  nombre: string;

  // FALSE para movimientos internos (descuentos, tranzado) que no mueven
  // caja ni banco.
  @Column({
    name: 'afecta_fondo',
    type: 'boolean',
    default: true,
  })
  afectaFondo: boolean;
}
