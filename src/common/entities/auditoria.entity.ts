import {
  BaseEntity,
  BeforeInsert,
  BeforeRecover,
  BeforeSoftRemove,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export abstract class Auditoria extends BaseEntity {
  @Column({
    nullable: false,
  })
  activo?: boolean;

  @Column({
    name: 'usuario_registro',
    select: false,
    nullable: false,
  })
  usuarioRegistro?: string;

  @Column({
    name: 'usuario_ultima_modificacion',
    select: true,
  })
  usuarioUltimaModificacion?: string;

  @CreateDateColumn({
    name: 'fecha_registro',
    select: false,
    nullable: false,
  })
  fechaRegistro?: Date;

  @UpdateDateColumn({
    name: 'fecha_ultima_modificacion',
    select: true,
  })
  fechaUltimaModificacion?: Date;

  @BeforeInsert()
  checkFieldsBeforeInsert() {
    if (this.activo === undefined || this.activo === null) {
      this.activo = true;
    }
    if (!this.usuarioRegistro) {
      this.usuarioRegistro = 'administrador';
    }
  }

  @BeforeUpdate()
  checkFieldsBeforeUpdate() {
    if (!this.usuarioUltimaModificacion)
      this.usuarioUltimaModificacion = 'administrador';
  }

  @BeforeSoftRemove()
  checkFielsBeforeSoftRemove() {
    this.activo = false;
  }

  @BeforeRecover()
  checkFielsBeforeRecover() {
    this.activo = true;
  }
}
