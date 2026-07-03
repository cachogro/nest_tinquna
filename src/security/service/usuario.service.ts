import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import * as bcrypt from 'bcrypt';

import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Usuario } from '../entities/usuario.entity';
import { Rol } from '../entities/rol.entity';
import { UsuarioRol } from '../entities/usuario-rol.entity';
import { CreateUsuarioDto } from '../dto/usuario/create-usuario.dto';
import { UpdateUsuarioDto } from '../dto/usuario/update-usuario.dto';
import { Persona } from '../entities/persona.entity';
import { RolPermiso } from '../entities/rol-permiso.entity';
import { Permiso } from '../entities/permiso.entity';
import { PersonaService } from './persona.service';

@Injectable()
export class UsuarioService {
  constructor(
    @InjectRepository(Usuario, 'ci')
    private readonly usuarioRepository: Repository<Usuario>,

    @InjectRepository(Persona, 'ci')
    private readonly personaRepository: Repository<Persona>,

    @InjectRepository(Rol, 'ci')
    private readonly rolRepository: Repository<Rol>,

    @InjectRepository(UsuarioRol, 'ci')
    private readonly usuarioRolRepository: Repository<UsuarioRol>,

    @InjectDataSource('ci') // Especificar el nombre de la conexión
    private dataSource: DataSource,
  ) {}

  async create(createUsuarioDto: CreateUsuarioDto, user: Usuario) {
    const {
      usuario,
      contrasena,
      idRol,
      persona: datosPersona,
    } = createUsuarioDto;

    // VALIDAR QUE LOS DATOS DE LA PERSONA EXISTAN
    // if (!datosPersona) {
    //   throw new BadRequestException('Los datos de la persona son obligatorios');
    // }

    // 1. Validar disponibilidad del nombre de usuario
    const usuarioExistente = await this.usuarioRepository.findOne({
      where: { usuario },
    });
    if (usuarioExistente) {
      throw new ConflictException(
        `El nombre de usuario '${usuario}' ya se encuentra registrado`,
      );
    }
    // 2. Validar duplicados de Persona (documento y correo)
    const existeNumeroDocumento = await this.personaRepository.findOne({
      where: { numeroDocumento: datosPersona.numeroDocumento, activo: true },
    });
    if (existeNumeroDocumento) {
      throw new ConflictException(
        `El número de documento '${datosPersona.numeroDocumento}' ya está registrado`,
      );
    }
    if (datosPersona.correoElectronico) {
      // Solo si se proporciona
      const existeCorreo = await this.personaRepository.findOne({
        where: {
          correoElectronico: datosPersona.correoElectronico,
          activo: true,
        },
      });
      if (existeCorreo) {
        throw new ConflictException(
          `El correo electrónico '${datosPersona.correoElectronico}' ya está registrado`,
        );
      }
    }

    // 3. Verificar que el rol exista (opcional pero recomendable)
    const rolExistente = await this.rolRepository.findOne({
      where: { id: idRol },
    });
    if (!rolExistente) {
      throw new BadRequestException(`El rol con ID '${idRol}' no existe`);
    }

    // 4. Encriptar contraseña con bcrypt
    const salt = await bcrypt.genSalt(10);
    const hashContrasena = await bcrypt.hash(contrasena, salt);

    // 5. Iniciar transacción
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // A. Crear y guardar la Persona
      const nuevaPersona = queryRunner.manager.create(Persona, {
        ...datosPersona,
        usuarioRegistro: user.usuario,
      });
      const personaGuardada = await queryRunner.manager.save(
        Persona,
        nuevaPersona,
      );

      // B. Crear y guardar el Usuario (asignando auditoría)
      const nuevoUsuario = queryRunner.manager.create(Usuario, {
        usuario,
        contrasena: hashContrasena,
        persona: personaGuardada,
        usuarioRegistro: user.usuario,
      });
      const usuarioGuardado = await queryRunner.manager.save(
        Usuario,
        nuevoUsuario,
      );

      // C. Crear y guardar UsuarioRol (asignando auditoría si aplica)
      const nuevoUsuarioRol = queryRunner.manager.create(UsuarioRol, {
        usuario: usuarioGuardado,
        rol: rolExistente,
        usuarioRegistro: user.usuario,
      });
      await queryRunner.manager.save(UsuarioRol, nuevoUsuarioRol);

      // Confirmar transacción
      await queryRunner.commitTransaction();

      // 6. Devolver el usuario creado (sin la contraseña)
      const { contrasena: _, ...resultadoUsuario } = usuarioGuardado;
      return {
        ...resultadoUsuario,
        persona: personaGuardada,
        rolAsignado: rolExistente,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error; // Relanzar para que el controlador maneje el error
    } finally {
      await queryRunner.release();
    }
  }

  async update2(registerUsuarioDto: UpdateUsuarioDto, user: Usuario): Promise<Usuario> {












    return user
  }














  async update(idUsuario: string, updateUsuarioDto: UpdateUsuarioDto, user: Usuario) {
  const {
    usuario,
    contrasena,
    idRol,
    persona: datosPersona,
  } = updateUsuarioDto;

  // 1. Verificar si el usuario existe y cargar sus relaciones actuales
  const usuarioActual: Usuario = await this.usuarioRepository.findOne({
    where: { id: idUsuario },
     relations: {
      persona: true, // Esta es la forma más explícita y segura en las últimas versiones de TypeORM
    },
  });

  if (!usuarioActual) {
    throw new NotFoundException(`No se encontró ningún usuario con el ID: ${idUsuario}`);
  }

  // 2. VALIDACIONES DE DUPLICADOS (Evitando validar contra sí mismo)

  if (usuario && usuario !== usuarioActual.usuario) {
    const usuarioExistente = await this.usuarioRepository.findOne({ where: { usuario } });
    if (usuarioExistente) {
      throw new ConflictException(`El nombre de usuario '${usuario}' ya se encuentra registrado`);
    }
  }

  if (datosPersona) {
    const idPersonaActual = usuarioActual.persona.id;

    // B. Validar duplicados de Documento (Excluyendo a la persona actual)
    if (datosPersona.numeroDocumento) {
      const existeNumeroDocumento = await this.personaRepository.findOne({
        where: { 
          numeroDocumento: datosPersona.numeroDocumento, 
          activo: true 
        },
      });
      // Si existe y pertenece a otra persona, lanza error
      if (existeNumeroDocumento && existeNumeroDocumento.id !== idPersonaActual) {
        throw new ConflictException(`El número de documento '${datosPersona.numeroDocumento}' ya está registrado`);
      }
    }

    // C. Validar duplicados de Correo (Excluyendo a la persona actual)
    if (datosPersona.correoElectronico) {
      const existeCorreo = await this.personaRepository.findOne({
        where: { 
          correoElectronico: datosPersona.correoElectronico, 
          activo: true 
        },
      });
      if (existeCorreo && existeCorreo.id !== idPersonaActual) {
        throw new ConflictException(`El correo electrónico '${datosPersona.correoElectronico}' ya está registrado`);
      }
    }
  }

  // 3. Verificar que el nuevo rol exista si se solicita un cambio
  let nuevoRol;
  if (idRol) {
    nuevoRol = await this.rolRepository.findOne({ where: { id: idRol } });
    if (!nuevoRol) {
      throw new BadRequestException(`El rol con ID '${idRol}' no existe`);
    }
  }

  // 4. Encriptar contraseña solo si el cliente envía una nueva
  let hashContrasena;
  if (contrasena) {
    const salt = await bcrypt.genSalt(10);
    hashContrasena = await bcrypt.hash(contrasena, salt);
  }

  // 5. Iniciar transacción
  const queryRunner = this.dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    let personaActualizada = usuarioActual.persona;
    if (datosPersona) {
      await queryRunner.manager.update(Persona, usuarioActual.persona?.id, {
        ...datosPersona,
        usuarioUltimaModificacion: user.usuario,
        fechaUltimaModificacion: new Date(),
      });
      // Recuperamos los datos frescos de la persona
      personaActualizada = await queryRunner.manager.findOne(Persona, { 
        where: { id: usuarioActual.persona?.id } 
      });
    }

    // B. Actualizar Usuario (construyendo objeto parcial dinámico)
    const datosActualizarUsuario: any = {};
    if (usuario) datosActualizarUsuario.usuario = usuario;
    if (hashContrasena) datosActualizarUsuario.contrasena = hashContrasena;
    
    // Solo ejecutamos update en DB si hay cambios reales para la tabla Usuario
    if (Object.keys(datosActualizarUsuario).length > 0) {
      datosActualizarUsuario.usuarioUltimaModificacion = user.usuario;
      datosActualizarUsuario.fechaUltimaModificacion = new Date();
      await queryRunner.manager.update(Usuario, idUsuario, datosActualizarUsuario);
    }

    // C. Actualizar Relación de Rol (UsuarioRol) si se envió un nuevo idRol
    if (nuevoRol) {
      // Modificamos el registro de la tabla intermedia asignando el nuevo rol
      await queryRunner.manager.update(
        UsuarioRol, 
        { usuario: { id: idUsuario } }, // Criterio de búsqueda (ID del usuario)
        { 
          rol: nuevoRol,
          usuarioUltimaModificacion: user.usuario,
          fechaUltimaModificacion: new Date()
        }
      );
    }

    // Confirmar transacción
    await queryRunner.commitTransaction();

    // 6. Obtener el usuario final actualizado para la respuesta limpia
    const usuarioFinal = await this.usuarioRepository.findOne({
      where: { id: idUsuario },
    });

    const { contrasena: _, ...resultadoUsuario } = usuarioFinal;
    return {
      ...resultadoUsuario,
      persona: personaActualizada,
      //rolAsignado: nuevoRol || 'Sin cambios en el rol',
    };

  } catch (error) {
    await queryRunner.rollbackTransaction();
    throw error;
  } finally {
    await queryRunner.release();
  }
}

















  async findAll(): Promise<Usuario[]> {
    return await this.usuarioRepository.find({
      where: { activo: true },
      // relations: ['persona'],
    });
  }

  async findOne(id: string): Promise<Usuario> {
    return await this.buscarPorId(id);
  }

  // async update(id: string, updateUsuarioDto: UpdateUsuarioDto): Promise<Usuario> {
  //   const usuario = await this.buscarPorId(id);

  //   if (updateUsuarioDto.usuario && updateUsuarioDto.usuario !== usuario.usuario) {
  //     const existeNombre = await this.usuarioRepository.findOne({ where: { usuario: updateUsuarioDto.usuario } });
  //     if (existeNombre) {
  //       throw new ConflictException(`El nombre de usuario '${updateUsuarioDto.usuario}' ya existe`);
  //     }
  //   }

  //   const usuarioActualizado = this.usuarioRepository.merge(usuario, updateUsuarioDto);
  //   return await this.usuarioRepository.save(usuarioActualizado);
  // }

  async activar(id: string): Promise<{ message: string }> {
    const usuario = await this.buscarPorId(id);
    usuario.activo = true;
    await this.usuarioRepository.save(usuario);
    return { message: `Usuario activado correctamente` };
  }

  async desactivar(id: string): Promise<{ message: string }> {
    const usuario = await this.buscarPorId(id);
    await this.usuarioRepository.softRemove(usuario);
    return { message: `Usuario desactivado correctamente` };
  }

  async buscarPorUsuario(username: string): Promise<Usuario> {
    const usuario = await this.usuarioRepository.findOne({
      where: { usuario: username, activo: true },
      //relations: ['persona'],
    });
    if (!usuario) {
      throw new NotFoundException(`El usuario '${username}' no fue encontrado`);
    }
    return usuario;
  }

  async buscarPorId(id: string): Promise<Usuario> {
    const usuario = await this.usuarioRepository.findOne({
      where: { id, activo: true },
      //relations: ['persona'],
    });
    if (!usuario) {
      throw new NotFoundException(
        `El usuario con ID ${id} no existe o está inactivo`,
      );
    }
    return usuario;
  }

  async cambiarPassword(
    id: string,
    contrasenaNueva: string,
  ): Promise<{ message: string }> {
    const usuario = await this.buscarPorId(id);

    const salt = await bcrypt.genSalt(10);
    usuario.contrasena = await bcrypt.hash(contrasenaNueva, salt);
    usuario.cambioClave = false;

    await this.usuarioRepository.save(usuario);
    return { message: 'Contraseña actualizada exitosamente' };
  }

  async asignarRol(idUsuario: string, idRol: string): Promise<UsuarioRol> {
    const existeRelacion = await this.usuarioRolRepository.findOne({
      where: { idUsuario, idRol },
    });

    if (existeRelacion) {
      if (existeRelacion.activo) {
        throw new BadRequestException(
          'El usuario ya tiene asignado este rol de forma activa',
        );
      }
      existeRelacion.activo = true;
      return await this.usuarioRolRepository.save(existeRelacion);
    }

    const nuevoUsuarioRol = this.usuarioRolRepository.create({
      idUsuario,
      idRol,
    });
    return await this.usuarioRolRepository.save(nuevoUsuarioRol);
  }

  async quitarRol(
    idUsuario: string,
    idRol: string,
  ): Promise<{ message: string }> {
    const relacion = await this.usuarioRolRepository.findOne({
      where: { idUsuario, idRol, activo: true },
    });

    if (!relacion) {
      throw new NotFoundException(
        'El usuario no tiene asignado ese rol de forma activa',
      );
    }

    await this.usuarioRolRepository.softRemove(relacion);
    return { message: 'Rol revocado exitosamente' };
  }

  async obtenerRoles(idUsuario: string): Promise<UsuarioRol[]> {
    await this.buscarPorId(idUsuario);
    return await this.usuarioRolRepository.find({
      where: { idUsuario, activo: true },
      //relations: ['rol'],
    });
  }
}
