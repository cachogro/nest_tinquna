import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Auditoria } from 'src/common/entities/auditoria.entity';
import { PersonaCi } from 'src/cluster/comercio-interno/entities/persona-ci.entity';

export type EstadoMemorandum = 'EMITIDO' | 'ANULADO';

/**
 * NINGUNA: solo llamada de atención. DIAS: días de haber descontados
 * (importe = haber diario * días, salvo que se envíe a mano). MONTO: multa
 * en bolivianos.
 */
export type TipoSancionMemorandum = 'NINGUNA' | 'DIAS' | 'MONTO';

/** Quien firma el memorándum (snapshot, igual que persona_autorizo). */
export interface EmisorMemorandum {
  idPersona: string | null;
  nombre: string;
  ci: string | null;
  cargo: string | null;
  tratamiento: string | null;
}

/**
 * Memorándum de llamada de atención (con o sin sanción) a una persona del
 * personal. CITE correlativo por gestión: "<prefijo>/021/2026".
 *
 * `numeroLlamada` es el ordinal que se imprime (PRIMERA, SEGUNDA...): por
 * defecto los memorándums EMITIDOS previos de la persona + 1.
 *
 * La sanción (importe > 0) se descuenta en la siguiente boleta de SUELDO de
 * la persona (línea SANCION del detalle); al pagarse queda `idBoletaPago` y
 * recién ahí el descuento se refleja en caja (el neto pagado es menor).
 */
@Entity({
  name: 'memorandum',
  schema: 'contabilidad',
})
export class Memorandum extends Auditoria {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ name: 'gestion', type: 'int' })
  gestion: number;

  // Correlativo dentro de la gestión. NO es el id.
  @Column({ name: 'numero', type: 'int' })
  numero: number;

  @Column({ name: 'cite', type: 'varchar', length: 80 })
  cite: string;

  @Column({ name: 'id_persona', type: 'bigint' })
  idPersona: string;

  @ManyToOne(() => PersonaCi, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_persona', referencedColumnName: 'id' })
  persona?: PersonaCi;

  // "Lic.", "Ing."... delante del nombre del destinatario.
  @Column({ name: 'tratamiento', type: 'varchar', length: 15, nullable: true })
  tratamiento?: string | null;

  @Column({ name: 'cargo', type: 'varchar', length: 100, nullable: true })
  cargo?: string | null;

  @Column({ name: 'emisor', type: 'jsonb' })
  emisor: EmisorMemorandum;

  @Column({ name: 'fecha', type: 'date' })
  fecha: string;

  @Column({ name: 'lugar', type: 'varchar', length: 60 })
  lugar: string;

  @Column({ name: 'asunto', type: 'varchar', length: 150 })
  asunto: string;

  @Column({ name: 'numero_llamada', type: 'int' })
  numeroLlamada: number;

  // Lo que hizo: "por consumir bebidas alcohólicas en horarios de trabajo".
  @Column({ name: 'motivo', type: 'varchar', length: 1000 })
  motivo: string;

  @Column({ name: 'tipo_sancion', type: 'varchar', length: 10, default: 'NINGUNA' })
  tipoSancion: TipoSancionMemorandum;

  @Column({ name: 'dias_sancion', type: 'numeric', precision: 5, scale: 1, nullable: true })
  diasSancion?: number | null;

  @Column({ name: 'importe_sancion', type: 'numeric', precision: 16, scale: 2, default: 0 })
  importeSancion: number;

  // Boleta de sueldo PAGADA en que se descontó la sanción (null = pendiente).
  @Column({ name: 'id_boleta_pago', type: 'bigint', nullable: true })
  idBoletaPago?: string | null;

  @Column({ name: 'estado', type: 'varchar', length: 10, default: 'EMITIDO' })
  estado: EstadoMemorandum;

  @Column({ name: 'motivo_anulacion', type: 'varchar', length: 255, nullable: true })
  motivoAnulacion?: string | null;

  @Column({ name: 'observaciones', type: 'varchar', length: 500, nullable: true })
  observaciones?: string | null;
}
