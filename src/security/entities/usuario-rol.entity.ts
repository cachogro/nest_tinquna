import { Auditoria } from 'src/common/entities/auditoria.entity';
import { Entity, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Usuario } from './usuario.entity';
import { Rol } from './rol.entity'; // Asumiendo que crearás esta entidad a continuación

@Entity({ name: 'usuario_rol', schema: 'seguridad' })
export class UsuarioRol extends Auditoria {
  @PrimaryColumn({
    name: 'id_usuario',
    type: 'bigint',
  })
  idUsuario: string;

  @PrimaryColumn({
    name: 'id_rol',
    type: 'bigint',
  })
  idRol: string;

  // Relación con la tabla Usuario
  @ManyToOne(() => Usuario, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_usuario' })
  usuario: Usuario;

  // Relación con la tabla Rol
  @ManyToOne(() => Rol, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_rol' })
  rol: Rol;
}
