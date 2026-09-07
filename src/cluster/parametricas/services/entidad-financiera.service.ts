import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { EntidadFinanciera } from '../entities/entidad-financiera.entity';
import { CuentaBancaria } from '../entities/cuenta-bancaria.entity';
import { Usuario } from 'src/security/entities/usuario.entity';
import { CreateEntidadFinancieraDto } from '../dto/entidad-financiera/create-entidad-financiera.dto';
import { UpdateEntidadFinancieraDto } from '../dto/entidad-financiera/update-entidad-financiera.dto';
import { CuentaBancariaDto } from '../dto/entidad-financiera/cuenta-bancaria.dto';

@Injectable()
export class EntidadFinancieraService {
  constructor(
    @InjectRepository(EntidadFinanciera, 'ci')
    private readonly entidadRepository: Repository<EntidadFinanciera>,

    @InjectRepository(CuentaBancaria, 'ci')
    private readonly cuentaRepository: Repository<CuentaBancaria>,

    @InjectDataSource('ci')
    private readonly dataSource: DataSource,
  ) {}

  /** Nombre y sigla se guardan en MAYÚSCULAS y sin espacios sobrantes. */
  private normalizar(valor?: string): string | undefined {
    if (valor === undefined || valor === null) {
      return undefined;
    }
    const limpio = valor.trim().toUpperCase();
    return limpio.length > 0 ? limpio : undefined;
  }

  private async obtenerEntidad(id: number): Promise<EntidadFinanciera> {
    const entidad = await this.entidadRepository.findOne({ where: { id } });
    if (!entidad) {
      throw new NotFoundException(
        'No se encontró la entidad financiera solicitada.',
      );
    }
    return entidad;
  }

  private async validarNombreUnico(
    nombre: string,
    idExcluir?: number,
  ): Promise<void> {
    const query = this.entidadRepository
      .createQueryBuilder('entidad')
      .where('UPPER(entidad.nombre) = :nombre', { nombre });

    if (idExcluir) {
      query.andWhere('entidad.id <> :id', { id: idExcluir });
    }

    if (await query.getOne()) {
      throw new ConflictException(
        `Ya existe una entidad financiera con el nombre "${nombre}".`,
      );
    }
  }

  /** Rechaza números de cuenta repetidos dentro del mismo payload. */
  private validarCuentasSinRepetir(cuentas: CuentaBancariaDto[]): void {
    const vistos = new Set<string>();
    for (const cuenta of cuentas) {
      const numero = cuenta.numeroCuenta.trim().toUpperCase();
      if (vistos.has(numero)) {
        throw new BadRequestException(
          `El número de cuenta "${cuenta.numeroCuenta}" está repetido en la solicitud.`,
        );
      }
      vistos.add(numero);
    }
  }

  async create(
    dto: CreateEntidadFinancieraDto,
    user: Usuario,
  ): Promise<EntidadFinanciera> {
    const nombre = this.normalizar(dto.nombre);
    await this.validarNombreUnico(nombre);

    const cuentas = dto.cuentas ?? [];
    this.validarCuentasSinRepetir(cuentas);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const entidad = queryRunner.manager.create(EntidadFinanciera, {
        nombre,
        sigla: this.normalizar(dto.sigla),
        usuarioRegistro: user.usuario,
      });
      const entidadGuardada = await queryRunner.manager.save(entidad);

      if (cuentas.length > 0) {
        const nuevas = cuentas.map((cuenta) =>
          queryRunner.manager.create(CuentaBancaria, {
            idEntidadFinanciera: entidadGuardada.id,
            numeroCuenta: cuenta.numeroCuenta.trim(),
            moneda: cuenta.moneda.trim().toUpperCase(),
            alias: cuenta.alias?.trim() || null,
            saldoInicial: cuenta.saldoInicial ?? 0,
            fechaSaldoInicial: cuenta.fechaSaldoInicial ?? null,
            usuarioRegistro: user.usuario,
          }),
        );
        await queryRunner.manager.save(nuevas);
      }

      await queryRunner.commitTransaction();

      return await this.entidadRepository.findOne({
        where: { id: entidadGuardada.id },
        relations: { cuentas: true },
      });
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async update(
    dto: UpdateEntidadFinancieraDto,
    user: Usuario,
  ): Promise<EntidadFinanciera> {
    const id = Number(dto.id);
    await this.obtenerEntidad(id);

    const nombre = this.normalizar(dto.nombre);
    await this.validarNombreUnico(nombre, id);

    const cuentas = dto.cuentas;
    if (cuentas && cuentas.length > 0) {
      this.validarCuentasSinRepetir(cuentas);
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.manager.update(EntidadFinanciera, id, {
        nombre,
        sigla: this.normalizar(dto.sigla),
        usuarioUltimaModificacion: user.usuario,
      });

      // Cuentas: upsert incremental. Con id se modifica, sin id se agrega.
      // Las cuentas existentes que no vengan en el payload no se tocan
      // (para darlas de baja se usa el endpoint de cambiar estado de cuenta).
      if (cuentas) {
        const existentes = await queryRunner.manager.find(CuentaBancaria, {
          where: { idEntidadFinanciera: id },
        });

        for (const cuenta of cuentas) {
          const numeroCuenta = cuenta.numeroCuenta.trim();
          const moneda = cuenta.moneda.trim().toUpperCase();
          const alias = cuenta.alias?.trim() || null;
          const saldoInicialCol =
            cuenta.saldoInicial !== undefined
              ? { saldoInicial: cuenta.saldoInicial }
              : {};
          const fechaSaldoInicialCol =
            cuenta.fechaSaldoInicial !== undefined
              ? { fechaSaldoInicial: cuenta.fechaSaldoInicial || null }
              : {};

          if (cuenta.id) {
            const actual = existentes.find((c) => c.id === cuenta.id);
            if (!actual) {
              throw new NotFoundException(
                `La cuenta con id ${cuenta.id} no pertenece a esta entidad financiera.`,
              );
            }
            const chocaOtra = existentes.some(
              (c) =>
                c.id !== cuenta.id &&
                c.numeroCuenta.toUpperCase() === numeroCuenta.toUpperCase(),
            );
            if (chocaOtra) {
              throw new ConflictException(
                `Ya existe otra cuenta con el número "${cuenta.numeroCuenta}" en esta entidad.`,
              );
            }
            await queryRunner.manager.update(CuentaBancaria, cuenta.id, {
              numeroCuenta,
              moneda,
              alias,
              ...saldoInicialCol,
              ...fechaSaldoInicialCol,
              usuarioUltimaModificacion: user.usuario,
            });
          } else {
            const yaExiste = existentes.some(
              (c) =>
                c.numeroCuenta.toUpperCase() === numeroCuenta.toUpperCase(),
            );
            if (yaExiste) {
              throw new ConflictException(
                `Ya existe una cuenta con el número "${cuenta.numeroCuenta}" en esta entidad.`,
              );
            }
            const nueva = queryRunner.manager.create(CuentaBancaria, {
              idEntidadFinanciera: id,
              numeroCuenta,
              moneda,
              alias,
              saldoInicial: cuenta.saldoInicial ?? 0,
              fechaSaldoInicial: cuenta.fechaSaldoInicial ?? null,
              usuarioRegistro: user.usuario,
            });
            await queryRunner.manager.save(nueva);
          }
        }
      }

      await queryRunner.commitTransaction();

      return await this.entidadRepository.findOne({
        where: { id },
        relations: { cuentas: true },
      });
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async cambiarEstado(
    id: number,
    estado: boolean,
    user: Usuario,
  ): Promise<EntidadFinanciera> {
    const entidad = await this.obtenerEntidad(id);
    entidad.activo = estado;
    entidad.usuarioUltimaModificacion = user.usuario;
    await this.entidadRepository.save(entidad);

    return await this.entidadRepository.findOne({
      where: { id },
      relations: { cuentas: true },
    });
  }

  async cambiarEstadoCuenta(
    idCuenta: number,
    estado: boolean,
    user: Usuario,
  ): Promise<CuentaBancaria> {
    const cuenta = await this.cuentaRepository.findOne({
      where: { id: idCuenta },
    });
    if (!cuenta) {
      throw new NotFoundException('No se encontró la cuenta solicitada.');
    }
    cuenta.activo = estado;
    cuenta.usuarioUltimaModificacion = user.usuario;
    return await this.cuentaRepository.save(cuenta);
  }

  async findAll(): Promise<EntidadFinanciera[]> {
    return await this.entidadRepository.find({
      relations: { cuentas: true },
      order: { nombre: 'ASC' },
    });
  }
}
