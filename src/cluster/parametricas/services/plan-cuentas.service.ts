import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull, Repository } from 'typeorm';
import {
  DIGITOS_POR_NIVEL,
  NIVEL_MAXIMO,
  NIVEL_MINIMO_DETALLE,
  PlanCuentas,
} from '../entities/plan-cuentas.entity';
import { cuentaTieneMovimientos } from '../plan-cuentas.util';
import { Usuario } from 'src/security/entities/usuario.entity';
import { CreatePlanCuentasDto } from '../dto/plan-cuentas/create-plan-cuentas.dto';
import { UpdatePlanCuentasDto } from '../dto/plan-cuentas/update-plan-cuentas.dto';

@Injectable()
export class PlanCuentasService {
  constructor(
    @InjectRepository(PlanCuentas, 'ci')
    private readonly planCuentasRepository: Repository<PlanCuentas>,
    @InjectDataSource('ci')
    private readonly dataSource: DataSource,
  ) {}

  private async obtener(
    id: number,
    manager: EntityManager = this.planCuentasRepository.manager,
  ): Promise<PlanCuentas> {
    const cuenta = await manager.findOne(PlanCuentas, { where: { id } });
    if (!cuenta) {
      throw new NotFoundException(
        'No se encontró la cuenta del plan de cuentas solicitada.',
      );
    }
    return cuenta;
  }

  private async validarNombreUnico(
    manager: EntityManager,
    nombre: string,
    idPadre: number | null,
    excluirId?: number,
  ) {
    const query = manager
      .createQueryBuilder(PlanCuentas, 'cuenta')
      .where('UPPER(cuenta.nombre) = UPPER(:nombre)', { nombre });
    if (idPadre) query.andWhere('cuenta.idPadre = :idPadre', { idPadre });
    else query.andWhere('cuenta.idPadre IS NULL');
    if (excluirId) query.andWhere('cuenta.id <> :id', { id: excluirId });

    if (await query.getOne()) {
      throw new ConflictException(
        `Ya existe una cuenta "${nombre}" dentro de la misma cuenta padre.`,
      );
    }
  }

  /** La cuenta AITB, si se envía, debe existir y ser imputable. */
  private async resolverCuentaAitb(
    manager: EntityManager,
    idCuentaAitb: number | null | undefined,
  ): Promise<number | null> {
    if (!idCuentaAitb) return null;
    const aitb = await this.obtener(idCuentaAitb, manager);
    if (aitb.tipo !== 'D') {
      throw new BadRequestException(
        'La cuenta de ajuste AITB debe ser una cuenta imputable (de detalle).',
      );
    }
    return aitb.id;
  }

  /** Código del padre + siguiente correlativo con los dígitos del nivel (110204 -> 110204008). */
  private async siguienteCodigo(
    manager: EntityManager,
    padre: PlanCuentas | null,
    nivel: number,
  ): Promise<string> {
    const digitos = DIGITOS_POR_NIVEL[nivel];
    const prefijo = padre?.codigo ?? '';
    const hermanas = await manager.find(PlanCuentas, {
      where: { idPadre: padre ? padre.id : IsNull() },
      select: { id: true, codigo: true },
    });
    const ultimo = hermanas.reduce(
      (max, h) => Math.max(max, Number(h.codigo.slice(prefijo.length))),
      0,
    );
    const siguiente = ultimo + 1;
    if (String(siguiente).length > digitos) {
      throw new BadRequestException(
        padre
          ? `La cuenta ${padre.codigo} ya no admite más subcuentas (máximo ${'9'.repeat(digitos)}).`
          : 'No se pueden crear más clases (máximo 9).',
      );
    }
    return prefijo + String(siguiente).padStart(digitos, '0');
  }

  async create(dto: CreatePlanCuentasDto, user: Usuario): Promise<PlanCuentas> {
    const nombre = dto.nombre.trim();

    return await this.dataSource.transaction(async (manager) => {
      // El bloqueo del padre serializa dos altas simultáneas bajo la misma cuenta.
      const padre = dto.idPadre
        ? await manager.findOne(PlanCuentas, {
            where: { id: dto.idPadre },
            lock: { mode: 'pessimistic_write' },
          })
        : null;
      if (dto.idPadre && !padre) {
        throw new NotFoundException('No se encontró la cuenta padre.');
      }
      if (padre && padre.tipo !== 'R') {
        throw new BadRequestException(
          `La cuenta ${padre.codigo} es imputable (de detalle): no puede tener subcuentas.`,
        );
      }
      if (padre && padre.activo === false) {
        throw new BadRequestException(
          `La cuenta ${padre.codigo} está dada de baja.`,
        );
      }

      const nivel = padre ? padre.nivel + 1 : 1;
      if (dto.tipo === 'D' && nivel < NIVEL_MINIMO_DETALLE) {
        throw new BadRequestException(
          `Solo las cuentas de nivel ${NIVEL_MINIMO_DETALLE} o ${NIVEL_MAXIMO} pueden ser imputables.`,
        );
      }
      // Nivel 5 siempre imputable; nivel 4 según se elija (por defecto con subcuentas).
      const imputable =
        nivel === NIVEL_MAXIMO ||
        (nivel === NIVEL_MINIMO_DETALLE && dto.tipo === 'D');
      await this.validarNombreUnico(manager, nombre, padre?.id ?? null);
      const codigo = await this.siguienteCodigo(manager, padre, nivel);

      let categoria: PlanCuentas['categoria'] = null;
      if (imputable) {
        // Sin valor explícito se copia de una hermana (mismo tipo de cuenta).
        const hermana = await manager.findOne(PlanCuentas, {
          where: { idPadre: padre.id, tipo: 'D' },
          order: { codigo: 'ASC' },
        });
        categoria =
          dto.categoria ??
          hermana?.categoria ??
          (codigo[0] === '4' ? 'OTRO_INGRESO' : 'GASTO_OPERATIVO');
      }

      return await manager.save(
        manager.create(PlanCuentas, {
          codigo,
          nombre,
          nivel,
          tipo: imputable ? 'D' : 'R',
          naturaleza: dto.naturaleza ?? padre?.naturaleza ?? 'D',
          idPadre: padre?.id ?? null,
          idCuentaAitb: await this.resolverCuentaAitb(
            manager,
            dto.idCuentaAitb,
          ),
          categoria,
          activo: true,
          usuarioRegistro: user.usuario,
        }),
      );
    });
  }

  /** Código, nivel y padre no cambian: para mover una cuenta se da de baja y se crea otra. */
  async update(dto: UpdatePlanCuentasDto, user: Usuario): Promise<PlanCuentas> {
    const manager = this.planCuentasRepository.manager;
    const cuenta = await this.obtener(dto.id);
    const nombre = dto.nombre.trim();
    await this.validarNombreUnico(manager, nombre, cuenta.idPadre, cuenta.id);

    cuenta.nombre = nombre;
    if (dto.naturaleza) cuenta.naturaleza = dto.naturaleza;
    if (dto.idCuentaAitb !== undefined) {
      if (dto.idCuentaAitb === cuenta.id) {
        throw new BadRequestException(
          'Una cuenta no puede ser su propia cuenta de ajuste AITB.',
        );
      }
      cuenta.idCuentaAitb = await this.resolverCuentaAitb(
        manager,
        dto.idCuentaAitb,
      );
    }
    if (dto.tipo && dto.tipo !== cuenta.tipo) {
      await this.cambiarTipo(manager, cuenta, dto);
    } else if (cuenta.tipo === 'D' && dto.categoria) {
      // Solo cambia si el front la envía; si no, se conserva la registrada.
      cuenta.categoria = dto.categoria;
    }
    cuenta.usuarioUltimaModificacion = user.usuario;
    return await this.planCuentasRepository.save(cuenta);
  }

  /**
   * Una cuenta de nivel 4 pasa a imputable (sin subcuentas) o a resumen (con
   * subcuentas). A imputable solo si no tiene subcuentas; a resumen solo si
   * no tiene movimientos, que quedarían en una cuenta que solo agrupa.
   */
  private async cambiarTipo(
    manager: EntityManager,
    cuenta: PlanCuentas,
    dto: UpdatePlanCuentasDto,
  ): Promise<void> {
    if (cuenta.nivel !== NIVEL_MINIMO_DETALLE) {
      throw new BadRequestException(
        `Solo una cuenta de nivel ${NIVEL_MINIMO_DETALLE} puede cambiar entre resumen e imputable.`,
      );
    }
    if (dto.tipo === 'D') {
      const subcuentas = await manager.count(PlanCuentas, {
        where: { idPadre: cuenta.id },
      });
      if (subcuentas > 0) {
        throw new BadRequestException(
          `La cuenta ${cuenta.codigo} tiene ${subcuentas} subcuenta(s): para que sea imputable no debe tener ninguna.`,
        );
      }
      cuenta.tipo = 'D';
      cuenta.categoria =
        dto.categoria ??
        cuenta.categoria ??
        (cuenta.codigo[0] === '4' ? 'OTRO_INGRESO' : 'GASTO_OPERATIVO');
      return;
    }
    if (await cuentaTieneMovimientos(manager, cuenta.id)) {
      throw new BadRequestException(
        `La cuenta ${cuenta.codigo} ya tiene movimientos: no puede pasar a cuenta de resumen.`,
      );
    }
    cuenta.tipo = 'R';
    cuenta.categoria = null;
  }

  /**
   * Baja lógica. Dar de baja una cuenta de resumen da de baja todas sus
   * subcuentas; reactivarla las reactiva. Para reactivar, el padre debe
   * estar activo. Devuelve cuántas cuentas cambiaron.
   */
  async cambiarEstado(
    id: number,
    activo: boolean,
    user: Usuario,
  ): Promise<{ cuenta: PlanCuentas; cuentasAfectadas: number }> {
    return await this.dataSource.transaction(async (manager) => {
      const cuenta = await this.obtener(id, manager);
      if (activo && cuenta.idPadre) {
        const padre = await this.obtener(cuenta.idPadre, manager);
        if (padre.activo === false) {
          throw new BadRequestException(
            `Primero reactive la cuenta padre ${padre.codigo} ${padre.nombre}.`,
          );
        }
      }

      const filas: { id: number }[] = await manager.query(
        `WITH RECURSIVE rama AS (
           SELECT id FROM parametrica.plan_cuentas WHERE id = $1
           UNION ALL
           SELECT h.id FROM parametrica.plan_cuentas h JOIN rama r ON h.id_padre = r.id
         )
         UPDATE parametrica.plan_cuentas p
            SET activo = $2, usuario_ultima_modificacion = $3, fecha_ultima_modificacion = now()
           FROM rama
          WHERE p.id = rama.id AND p.activo <> $2
         RETURNING p.id`,
        [id, activo, user.usuario],
      );

      return {
        cuenta: await this.obtener(id, manager),
        cuentasAfectadas: filas.length,
      };
    });
  }

  /**
   * Por defecto solo las cuentas imputables activas (catálogo de caja,
   * recibos, bancos...). Con `todos` el árbol completo, inactivas incluidas,
   * para la pantalla de administración. Siempre ordenado por código.
   */
  async findAll(todos = false): Promise<PlanCuentas[]> {
    if (todos) {
      return await this.planCuentasRepository.find({
        order: { codigo: 'ASC' },
      });
    }
    // El catálogo trae la cuenta padre (nivel 4) para mostrar a qué grupo pertenece.
    return await this.planCuentasRepository.find({
      where: { activo: true, tipo: 'D' },
      relations: { padre: true },
      order: { codigo: 'ASC' },
    });
  }
}
