import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { Auditoria } from 'src/common/entities/auditoria.entity';

/**
 * Datos de la empresa como empleador (una sola fila): cabecera y pie de la
 * planilla de sueldos y salarios.
 */
@Entity({
  name: 'datos_empleador',
  schema: 'parametrica',
})
export class DatosEmpleador extends Auditoria {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'razon_social', type: 'varchar', length: 150 })
  razonSocial: string;

  @Column({ name: 'nit', type: 'varchar', length: 30, nullable: true })
  nit?: string | null;

  /** Registro Único de Exportadores. */
  @Column({ name: 'ruex', type: 'varchar', length: 30, nullable: true })
  ruex?: string | null;

  /** Número de Identificación Minera. */
  @Column({ name: 'nim', type: 'varchar', length: 30, nullable: true })
  nim?: string | null;

  // Casa matriz (encabezado de reportes).
  @Column({ name: 'sucursal', type: 'varchar', length: 60, nullable: true })
  sucursal?: string | null;

  @Column({ name: 'punto_venta', type: 'varchar', length: 10, nullable: true })
  puntoVenta?: string | null;

  @Column({ name: 'direccion', type: 'varchar', length: 200, nullable: true })
  direccion?: string | null;

  @Column({ name: 'telefono', type: 'varchar', length: 30, nullable: true })
  telefono?: string | null;

  @Column({ name: 'ciudad', type: 'varchar', length: 60, nullable: true })
  ciudad?: string | null;

  /** N° de empleador del Ministerio de Trabajo, Empleo y Previsión Social. */
  @Column({ name: 'numero_empleador_mteps', type: 'varchar', length: 40, nullable: true })
  numeroEmpleadorMteps?: string | null;

  /** N° de empleador de la Caja Nacional de Salud. */
  @Column({ name: 'numero_empleador_cns', type: 'varchar', length: 40, nullable: true })
  numeroEmpleadorCns?: string | null;

  @Column({ name: 'representante_legal', type: 'varchar', length: 150, nullable: true })
  representanteLegal?: string | null;

  @Column({ name: 'ci_representante_legal', type: 'varchar', length: 30, nullable: true })
  ciRepresentanteLegal?: string | null;
}
