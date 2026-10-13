import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Auditoria } from 'src/common/entities/auditoria.entity';
import { Kardex } from './kardex.entity';
import { KardexInteresCuota } from './kardex-interes-cuota.entity';
import { KardexInteresEvento } from './kardex-interes-evento.entity';

export type EstadoKardexInteres = 'VIGENTE' | 'FINALIZADO';

/**
 * Plan de interés por mora de un kardex (ACTOR, ASOCIADO o PERSONAL): tasa
 * mensual (%) y desde cuándo corre. El interés se lleva APARTE del kardex
 * (una cuota por mes, ver KardexInteresCuota) porque es negociable: se
 * puede bajar la tasa o condonar. Recién al cargarlo se vuelve una línea
 * DEBE del kardex.
 *
 *   VIGENTE:    genera una cuota cada mes (uno solo por kardex).
 *   FINALIZADO: dejó de generar cuotas; las pendientes siguen ahí hasta
 *               cargarlas o condonarlas.
 */
@Entity({
  name: 'kardex_interes',
  schema: 'contabilidad',
})
export class KardexInteres extends Auditoria {
  @PrimaryGeneratedColumn({
    type: 'bigint',
  })
  id: string;

  @Column({
    name: 'id_kardex',
    type: 'bigint',
  })
  idKardex: string;

  @ManyToOne(() => Kardex, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'id_kardex',
    referencedColumnName: 'id',
  })
  kardex?: Kardex;

  // Porcentaje mensual: 3 = 3 % al mes.
  @Column({
    name: 'tasa_mensual',
    type: 'numeric',
    precision: 7,
    scale: 4,
  })
  tasaMensual: number;

  // Desde cuándo corre; la primera cuota vence un mes después.
  @Column({
    name: 'fecha_inicio',
    type: 'date',
  })
  fechaInicio: string;

  @Column({
    name: 'estado',
    type: 'varchar',
    length: 12,
    default: 'VIGENTE',
  })
  estado: EstadoKardexInteres;

  @Column({
    name: 'fecha_fin',
    type: 'date',
    nullable: true,
  })
  fechaFin?: string | null;

  @Column({
    name: 'observaciones',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  observaciones?: string | null;

  @OneToMany(() => KardexInteresCuota, (cuota) => cuota.kardexInteres)
  cuotas?: KardexInteresCuota[];

  @OneToMany(() => KardexInteresEvento, (evento) => evento.kardexInteres)
  eventos?: KardexInteresEvento[];
}
