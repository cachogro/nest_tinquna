import { Auditoria } from 'src/common/entities/auditoria.entity';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Codificacion } from 'src/cluster/parametricas/entities/codificacion.entity';
import { EstadoRegistro } from 'src/cluster/parametricas/entities/estado-registro.entity';
import { PersonaCi } from './persona-ci.entity';

@Entity({
  name: 'recepcion_mineral',
  schema: 'comercio_interno',
})
export class RecepcionMineral extends Auditoria {
  @PrimaryGeneratedColumn({
    type: 'bigint',
  })
  id: string;

  @Column({
    name: 'correlativo',
    type: 'bigint',
    nullable: false,
  })
  correlativo: string;

  @Column({
    name: 'codigo_operacion',
    type: 'varchar',
    length: 20,
    nullable: false,
  })
  codigoOperacion: string;

  // ============================
  // Codificación
  // ============================

  @Column({
    name: 'id_codificacion',
    type: 'bigint',
    nullable: false,
  })
  idCodificacion: string;

  @ManyToOne(() => Codificacion, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'id_codificacion',
  })
  codificacion: Codificacion;

  // ============================
  // Persona (Proveedor)
  // ============================

  @Column({
    name: 'id_persona',
    type: 'bigint',
    nullable: false,
  })
  idPersona: string;

  @ManyToOne(() => PersonaCi, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'id_persona',
  })
  persona: PersonaCi;

  // ============================
  // Datos de Recepción
  // ============================

  @Column({
    name: 'numero_sacos',
    type: 'integer',
    nullable: false,
  })
  numeroSacos: number;

  @Column({
    name: 'peso_neto',
    type: 'numeric',
    precision: 12,
    scale: 5,
    nullable: false,
  })
  pesoNeto: number;

  @Column({
    name: 'anticipo',
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  anticipo?: number;

  @Column({
    name: 'ley',
    type: 'numeric',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  ley?: number;

  @Column({
    name: 'total_valor_bruto',
    type: 'numeric',
    precision: 14,
    scale: 2,
    nullable: true,
  })
  totalValorBruto?: number;

  @Column({
    name: 'fecha_operacion',
    type: 'date',
    nullable: false,
  })
  fechaOperacion: Date;

  @Column({
    name: 'observaciones',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  observaciones?: string;

  // ============================
  // Estado
  // ============================

  @Column({
    name: 'id_estado',
    type: 'smallint',
    nullable: false,
  })
  idEstado: number;

  @ManyToOne(() => EstadoRegistro, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'id_estado',
  })
  estado: EstadoRegistro;
}
