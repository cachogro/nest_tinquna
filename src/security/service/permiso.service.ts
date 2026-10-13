import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Permiso } from '../entities/permiso.entity';
import { Rol } from '../entities/rol.entity';
import { RolPermiso } from '../entities/rol-permiso.entity';
import { Usuario } from '../entities/usuario.entity';
import { ValidRoles } from '../enums/valid-roles';
import {
  ORDEN_MODULOS_PERMISO,
  ROLES_PERMITIDOS_POR_PERMISO,
} from '../enums/permisos';
import { GuardarPermisosRolDto } from '../dto/permiso/guardar-permisos-rol.dto';
import {
  MatrizPermisosDto,
  ModuloMatrizDto,
} from '../dto/permiso/matriz-permisos.dto';

const CODIGOS_CATALOGO = Object.keys(ROLES_PERMITIDOS_POR_PERMISO);

@Injectable()
export class PermisoService {
  constructor(
    @InjectRepository(Permiso, 'ci')
    private readonly permisoRepository: Repository<Permiso>,

    @InjectRepository(RolPermiso, 'ci')
    private readonly rolPermisoRepository: Repository<RolPermiso>,

    @InjectRepository(Rol, 'ci')
    private readonly rolRepository: Repository<Rol>,
  ) {}

  /**
   * Códigos de permiso que tiene un usuario por sus roles. Es lo que el front
   * usa para armar el menú, las rutas y los botones.
   */
  async codigosDeUsuario(usuario: Usuario): Promise<string[]> {
    const roles = usuario.roles ?? [];

    if (roles.some((rol) => rol.codigo === ValidRoles.administrador)) {
      return CODIGOS_CATALOGO;
    }

    if (roles.length === 0) return [];

    const asignados = await this.rolPermisoRepository.find({
      where: {
        idRol: In(roles.map((rol) => rol.id)),
        permiso: { codigo: In(CODIGOS_CATALOGO), activo: true },
      },
      relations: { permiso: true },
    });

    const codigosRol = new Map(roles.map((rol) => [rol.id, rol.codigo]));
    const codigos = new Set<string>();

    for (const asignado of asignados) {
      // Si el back dejó de permitir ese rol para la pantalla, la asignación
      // guardada deja de valer aunque siga en la tabla.
      if (
        this.rolPermitido(
          asignado.permiso.codigo,
          codigosRol.get(asignado.idRol),
        )
      ) {
        codigos.add(asignado.permiso.codigo);
      }
    }

    return CODIGOS_CATALOGO.filter((codigo) => codigos.has(codigo));
  }

  async obtenerMatriz(): Promise<MatrizPermisosDto> {
    const [roles, permisos, asignados] = await Promise.all([
      this.rolRepository.find({ where: { activo: true }, order: { id: 'ASC' } }),
      this.permisosCatalogo(),
      this.rolPermisoRepository.find(),
    ]);

    const codigoRolPorId = new Map(roles.map((rol) => [rol.id, rol.codigo]));
    const rolesPorPermiso = new Map<string, string[]>();
    for (const asignado of asignados) {
      const codigoRol = codigoRolPorId.get(asignado.idRol);
      if (!codigoRol) continue;
      const lista = rolesPorPermiso.get(asignado.idPermiso) ?? [];
      lista.push(codigoRol);
      rolesPorPermiso.set(asignado.idPermiso, lista);
    }

    const modulos = new Map<string, ModuloMatrizDto>();
    for (const permiso of permisos) {
      const rolesPermitidos = ROLES_PERMITIDOS_POR_PERMISO[permiso.codigo];
      const guardados = rolesPorPermiso.get(permiso.id) ?? [];

      const modulo = modulos.get(permiso.modulo) ?? {
        modulo: permiso.modulo,
        permisos: [],
      };
      modulo.permisos.push({
        codigo: permiso.codigo,
        nombre: permiso.nombre,
        descripcion: permiso.descripcion ?? null,
        rolesPermitidos,
        rolesAsignados: roles
          .map((rol) => rol.codigo)
          .filter(
            (codigoRol) =>
              codigoRol === ValidRoles.administrador ||
              (guardados.includes(codigoRol) &&
                this.rolPermitido(permiso.codigo, codigoRol)),
          ),
      });
      modulos.set(permiso.modulo, modulo);
    }

    return {
      roles: roles.map((rol) => ({
        id: rol.id,
        codigo: rol.codigo,
        nombre: rol.nombre,
        esAdministrador: rol.codigo === ValidRoles.administrador,
      })),
      modulos: [...modulos.values()].sort(
        (a, b) => this.ordenModulo(a.modulo) - this.ordenModulo(b.modulo),
      ),
    };
  }

  /**
   * Reemplaza los permisos de un rol por la lista recibida (se envía
   * completa: lo que no venga se le quita).
   */
  async guardarPermisosRol(
    dto: GuardarPermisosRolDto,
    user: Usuario,
  ): Promise<MatrizPermisosDto> {
    const rol = await this.rolRepository.findOne({
      where: { id: String(dto.idRol), activo: true },
    });

    if (!rol) {
      throw new NotFoundException('No existe el rol indicado o está inactivo.');
    }

    if (rol.codigo === ValidRoles.administrador) {
      throw new BadRequestException(
        'El administrador tiene siempre todos los permisos y no se puede modificar.',
      );
    }

    const catalogo = await this.permisosCatalogo();
    const permisoPorCodigo = new Map(catalogo.map((p) => [p.codigo, p]));

    const desconocidos = dto.permisos.filter((c) => !permisoPorCodigo.has(c));
    if (desconocidos.length > 0) {
      throw new BadRequestException(
        `Los siguientes permisos no existen: ${desconocidos.join(', ')}.`,
      );
    }

    const noPermitidos = dto.permisos.filter(
      (codigo) => !this.rolPermitido(codigo, rol.codigo),
    );
    if (noPermitidos.length > 0) {
      const nombres = noPermitidos.map((c) => permisoPorCodigo.get(c).nombre);
      throw new BadRequestException(
        `El rol ${rol.nombre} no puede tener acceso a: ${nombres.join(', ')}.`,
      );
    }

    await this.rolPermisoRepository.manager.transaction(async (manager) => {
      // Solo se tocan los permisos del catálogo de pantallas.
      await manager.delete(RolPermiso, {
        idRol: rol.id,
        idPermiso: In(catalogo.map((p) => p.id)),
      });

      if (dto.permisos.length > 0) {
        await manager.insert(
          RolPermiso,
          dto.permisos.map((codigo) => ({
            idRol: rol.id,
            idPermiso: permisoPorCodigo.get(codigo).id,
            usuarioRegistro: user.usuario,
          })),
        );
      }
    });

    return await this.obtenerMatriz();
  }

  private async permisosCatalogo(): Promise<Permiso[]> {
    return await this.permisoRepository.find({
      where: { codigo: In(CODIGOS_CATALOGO), activo: true },
      order: { id: 'ASC' },
    });
  }

  private rolPermitido(codigoPermiso: string, codigoRol?: string): boolean {
    return (ROLES_PERMITIDOS_POR_PERMISO[codigoPermiso] ?? []).includes(
      codigoRol as ValidRoles,
    );
  }

  private ordenModulo(modulo: string): number {
    const indice = ORDEN_MODULOS_PERMISO.indexOf(modulo);
    return indice === -1 ? ORDEN_MODULOS_PERMISO.length : indice;
  }
}
