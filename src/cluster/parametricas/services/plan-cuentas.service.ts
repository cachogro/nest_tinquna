import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlanCuentas } from '../entities/plan-cuentas.entity';
import { Usuario } from 'src/security/entities/usuario.entity';
import { CreatePlanCuentasDto } from '../dto/plan-cuentas/create-plan-cuentas.dto';
import { UpdatePlanCuentasDto } from '../dto/plan-cuentas/update-plan-cuentas.dto';

@Injectable()
export class PlanCuentasService {
  constructor(
    @InjectRepository(PlanCuentas, 'ci')
    private readonly planCuentasRepository: Repository<PlanCuentas>,
  ) {}

  private async obtener(id: number): Promise<PlanCuentas> {
    const cuenta = await this.planCuentasRepository.findOne({ where: { id } });
    if (!cuenta) {
      throw new NotFoundException('No se encontró la cuenta del plan de cuentas solicitada.');
    }
    return cuenta;
  }

  private async validarNombreUnico(nombre: string, excluirId?: number) {
    const query = this.planCuentasRepository
      .createQueryBuilder('cuenta')
      .where('UPPER(cuenta.nombre) = UPPER(:nombre)', { nombre });
    if (excluirId) query.andWhere('cuenta.id <> :id', { id: excluirId });

    if (await query.getOne()) {
      throw new ConflictException(
        `Ya existe una cuenta del plan de cuentas con el nombre "${nombre}".`,
      );
    }
  }

  async create(dto: CreatePlanCuentasDto, user: Usuario): Promise<PlanCuentas> {
    const nombre = dto.nombre.trim();
    await this.validarNombreUnico(nombre);

    return await this.planCuentasRepository.save(
      this.planCuentasRepository.create({
        nombre,
        esEgreso: dto.esEgreso,
        categoria: dto.categoria ?? (dto.esEgreso ? 'GASTO_OPERATIVO' : 'OTRO_INGRESO'),
        usuarioRegistro: user.usuario,
      }),
    );
  }

  async update(dto: UpdatePlanCuentasDto, user: Usuario): Promise<PlanCuentas> {
    const cuenta = await this.obtener(dto.id);
    const nombre = dto.nombre.trim();
    await this.validarNombreUnico(nombre, cuenta.id);

    cuenta.nombre = nombre;
    cuenta.esEgreso = dto.esEgreso;
    // Solo cambia si el front la envía; si no, se conserva la registrada.
    if (dto.categoria) cuenta.categoria = dto.categoria;
    cuenta.usuarioUltimaModificacion = user.usuario;
    return await this.planCuentasRepository.save(cuenta);
  }

  async cambiarEstado(
    id: number,
    activo: boolean,
    user: Usuario,
  ): Promise<PlanCuentas> {
    const cuenta = await this.obtener(id);
    cuenta.activo = activo;
    cuenta.usuarioUltimaModificacion = user.usuario;
    return await this.planCuentasRepository.save(cuenta);
  }

  /** Por defecto solo los activos (los usa el catálogo de caja/recibos). */
  async findAll(incluirInactivos = false): Promise<PlanCuentas[]> {
    return await this.planCuentasRepository.find({
      where: incluirInactivos ? {} : { activo: true },
      order: { nombre: 'ASC' },
    });
  }
}
