import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Auditoria } from 'src/common/entities/auditoria.entity';
import { Municipio } from './municipio.entity';
import { TipoActorProductivoMinero } from './tipo-actor-productivo-minero.entity';

/**
 * Comprador del mineral ya adquirido a los actores productivos mineros
 * (comercializadora, ingenio comprador, exportadora, etc.). Es la
 * contraparte del flujo de VENTAS, separada de `ActorProductivoMinero`
 * (contraparte del flujo de COMPRAS) para no mezclar ambos conceptos de
 * negocio en una misma tabla.
 */
@Entity({
  name: 'cliente',
  schema: 'parametrica',
})
export class Cliente extends Auditoria {
  @PrimaryGeneratedColumn({
    type: 'bigint',
  })
  id: string;

  @Column({
    name: 'nombre',
    type: 'varchar',
    length: 150,
  })
  nombre: string;

  // Clasificación del cliente (Empresa, Cooperativa, Comercializadora,
  // Exportadora...). Reutiliza el mismo catálogo que ActorProductivoMinero
  // (parametrica.tipo_actor_productivo_minero): es solo una etiqueta, no
  // implica que el cliente sea también un proveedor.
  @Column({
    name: 'id_tipo_actor_productivo_minero',
    type: 'bigint',
    nullable: true,
  })
  idTipoActorProductivoMinero?: string;

  @ManyToOne(() => TipoActorProductivoMinero, {
    nullable: true,
    eager: true,
  })
  @JoinColumn({
    name: 'id_tipo_actor_productivo_minero',
    referencedColumnName: 'id',
  })
  tipoActorProductivoMinero?: TipoActorProductivoMinero;

  @Column({
    name: 'direccion',
    type: 'varchar',
    length: 250,
  })
  direccion: string;

  @Column({
    name: 'telefono',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  telefono?: string;

  @Column({
    name: 'id_municipio',
    type: 'int',
    nullable: true,
  })
  idMunicipio?: number;

  @ManyToOne(() => Municipio, {
    eager: true,
  })
  @JoinColumn({
    name: 'id_municipio',
    referencedColumnName: 'id',
  })
  municipio?: Municipio;

  // NIT u otro identificador tributario del cliente (comercializadora/empresa).
  @Column({
    name: 'nit',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  nit?: string;

  @Column({
    name: 'observaciones',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  observaciones?: string;

  /**
   * Fecha de inicio de operaciones del cliente con la empresa (YYYY-MM-DD).
   * Si el front la envía vacía, el servicio la completa con la fecha actual
   * (hora de Bolivia) al registrar. Importante para la migración de datos
   * históricos del Excel: ahí sí se debe mandar la fecha real.
   */
  @Column({
    name: 'fecha_inicio_operaciones',
    type: 'date',
    nullable: false,
  })
  fechaInicioOperaciones: string;
}
