import { Auditoria } from 'src/common/entities/auditoria.entity';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ColumnNumericTransformer } from 'src/common/utils/numeric-column.transform';
import { ValorizacionMineral } from '../valorizacion/valorizacion-mineral.entity';
import { PromedioMineral } from './promedio-mineral.entity';

@Entity({
  name: 'promedio_mineral_detalle',
  schema: 'comercio_interno',
})
export class PromedioMineralDetalle extends Auditoria {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ name: 'id_promedio_mineral', type: 'bigint', nullable: false })
  idPromedioMineral: string;

  @ManyToOne(() => PromedioMineral, (p) => p.detalles, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'id_promedio_mineral' })
  promedio: PromedioMineral;

  @Column({ name: 'id_valorizacion', type: 'bigint', nullable: false })
  idValorizacion: string;

  @ManyToOne(() => ValorizacionMineral, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'id_valorizacion' })
  valorizacion: ValorizacionMineral;

  @Column({ name: 'numero_sacos', type: 'int4', nullable: true })
  numeroSacos?: number;

  // Peso con el que la valorización entró al promedio (snapshot).
  @Column({
    name: 'peso_kilogramos',
    type: 'numeric',
    precision: 15,
    scale: 5,
    nullable: false,
    transformer: new ColumnNumericTransformer(),
  })
  pesoKilogramos: number;

  // Humedad (%) de la valorización al entrar al promedio (snapshot).
  @Column({
    name: 'humedad_porcentaje',
    type: 'numeric',
    precision: 12,
    scale: 5,
    nullable: true,
    transformer: new ColumnNumericTransformer(),
  })
  humedadPorcentaje?: number | null;

  // Valor neto de venta (Bs) de la valorización al entrar al promedio (snapshot).
  @Column({
    name: 'valor_neto_venta_bolivianos',
    type: 'numeric',
    precision: 15,
    scale: 2,
    default: 0,
    nullable: false,
    transformer: new ColumnNumericTransformer(),
  })
  valorNetoVentaBolivianos: number;
}
