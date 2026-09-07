import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Auditoria } from 'src/common/entities/auditoria.entity';
import { CuentaBancaria } from './cuenta-bancaria.entity';

@Entity({
  name: 'entidad_financiera',
  schema: 'parametrica',
})
export class EntidadFinanciera extends Auditoria {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    name: 'nombre',
    type: 'varchar',
    length: 80,
  })
  nombre: string;

  // Sigla como aparece en el comprobante bancario (ej. "UNION S.A.").
  @Column({
    name: 'sigla',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  sigla?: string;

  @OneToMany(() => CuentaBancaria, (cuenta) => cuenta.entidadFinanciera)
  cuentas?: CuentaBancaria[];
}
