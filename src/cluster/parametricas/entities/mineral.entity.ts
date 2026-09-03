import { Column, Entity, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Auditoria } from 'src/common/entities/auditoria.entity';
import { ColumnNumericTransformer } from 'src/common/utils/numeric-column.transform';
import { CotizacionMineral } from './cotizacion-mineral.entity';

@Entity({ name: 'mineral', schema: 'parametrica' })
export class Mineral extends Auditoria {
  @PrimaryGeneratedColumn({
    type: 'bigint',
  })
  id: string;

  @Column({
    name: 'descripcion',
    type: 'varchar',
  })
  descripcion: string;

  @Column({
    name: 'simbolo',
    type: 'varchar',
  })
  simbolo: string;

  @Column({
    name: 'unidad_cotizacion',
    type: 'varchar',
  })
  unidadCotizacion: string;

  @Column({
    name: 'detalle_mineral',
    type: 'varchar',
  })
  detalleMineral: string;

  @Column({
    name: 'factor_conversion',
    type: 'float',
    transformer: new ColumnNumericTransformer(),
  })
  factorConversion: number;

  @Column({
    name: 'tipo',
    type: 'varchar',
  })
  tipo: string;

  @Column({
    name: 'alicuota_externa',
    type: 'numeric',
    nullable: true,
    transformer: new ColumnNumericTransformer(),
  })
  alicuotaExterna?: number;

  @Column({
    name: 'alicuota_interna',
    type: 'numeric',
    nullable: true,
    transformer: new ColumnNumericTransformer(),
  })
  alicuotaInterna?: number;

  @OneToOne(
    () => CotizacionMineral,
    (cotizacionMineral) => cotizacionMineral.mineral,
    {
      eager: false,
    },
  )
  cotizacionMineral?: CotizacionMineral;
}
