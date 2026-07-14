import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { Auditoria } from 'src/common/entities/auditoria.entity';

@Entity({ name: 'mineral', schema: 'parametrica' })
export class Mineral extends Auditoria {
  @PrimaryGeneratedColumn({
    type: 'bigint',
  })
  id: string;

  @Column({
    length: 50,
  })
  descripcion: string;

  @Column({
    length: 30,
    nullable: true,
  })
  simbolo?: string;

  @Column({
    name: 'unidad_cotizacion',
    length: 3,
  })
  unidadCotizacion: string;

  @Column({
    name: 'detalle_mineral',
    length: 45,
  })
  detalleMineral: string;

  @Column({
    name: 'factor_conversion',
    type: 'double precision',
    nullable: true,
  })
  factorConversion?: number;

  @Column({
    name: 'calculo_regalia',
    type: 'bytea',
    nullable: true,
  })
  calculoRegalia?: Buffer;

  @Column({
    nullable: true,
  })
  tipo?: string;
}