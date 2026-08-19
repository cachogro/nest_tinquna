import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { EscalaPrecioMineral } from '../entities/escala-precio-mineral.entity';
import { Mineral } from '../entities/mineral.entity';
import { CreateEscalaPrecioMineralDto } from '../dto/escala-precio-mineral/create-escala-precio-mineral.dto';
import { UpdateEscalaPrecioMineralDto } from '../dto/escala-precio-mineral/update-escala-precio-mineral.dto';
import { Usuario } from 'src/security/entities/usuario.entity';

// Bolivia no tiene horario de verano: el offset respecto a UTC es siempre -04:00.
const OFFSET_BOLIVIA = '-04:00';

@Injectable()
export class EscalaPrecioMineralService {
  constructor(
    @InjectRepository(EscalaPrecioMineral, 'ci')
    private readonly escalaPrecioRepository: Repository<EscalaPrecioMineral>,

    @InjectRepository(Mineral, 'ci')
    private readonly mineralRepository: Repository<Mineral>,

    @InjectDataSource('ci')
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Crea en bloque todos los tramos de ley de un mineral que comparten la
   * misma vigencia (idMineral, fechaVigenciaInicial y fechaVigenciaFinal son
   * un solo valor para toda la carga; cada fila solo aporta
   * ley/precioPunto/precioTm).
   *
   * Si la nueva vigencia se solapa con tramos activos existentes del mismo
   * mineral (sin importar la ley), esos tramos se desactivan (activo=false)
   * por completo y quedan reemplazados por la tabla nueva.
   */
  async create(
    createDto: CreateEscalaPrecioMineralDto,
    user: Usuario,
  ): Promise<EscalaPrecioMineral[]> {
    const mineral = await this.mineralRepository.findOne({
      where: { id: String(createDto.idMineral), activo: true },
    });

    if (!mineral) {
      throw new NotFoundException(
        'No existe el mineral seleccionado o se encuentra inactivo.',
      );
    }

    if (
      createDto.fechaVigenciaFinal &&
      new Date(createDto.fechaVigenciaFinal) <=
        new Date(createDto.fechaVigenciaInicial)
    ) {
      throw new BadRequestException(
        'La fecha de vigencia final no puede ser menor o igual a la fecha de vigencia inicial.',
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Lock por mineral: serializa cargas concurrentes de la tabla de un mismo mineral.
      await queryRunner.manager.query('SELECT pg_advisory_xact_lock($1)', [
        createDto.idMineral,
      ]);

      const tramosExistentes = await queryRunner.manager
        .createQueryBuilder(EscalaPrecioMineral, 'escala')
        .setLock('pessimistic_write')
        .where('escala.id_mineral = :idMineral', {
          idMineral: createDto.idMineral,
        })
        .andWhere('escala.activo = true')
        .getMany();

      const inicioNuevo = new Date(createDto.fechaVigenciaInicial);
      const finNuevo = createDto.fechaVigenciaFinal
        ? new Date(createDto.fechaVigenciaFinal)
        : null;

      // Cualquier tramo activo del mineral cuya vigencia se solape con la
      // nueva (sin importar la ley) queda reemplazado: se desactiva por completo.
      const tramosASuperar = tramosExistentes.filter((t) => {
        const inicioExistente = new Date(t.fechaVigenciaInicial);
        const finExistente = t.fechaVigenciaFinal
          ? new Date(t.fechaVigenciaFinal)
          : null;

        const empiezaAntesDeQueTermineElExistente =
          !finExistente || inicioNuevo <= finExistente;
        const terminaDespuesDeQueEmpieceElExistente =
          !finNuevo || finNuevo >= inicioExistente;

        return (
          empiezaAntesDeQueTermineElExistente &&
          terminaDespuesDeQueEmpieceElExistente
        );
      });

      if (tramosASuperar.length) {
        for (const tramo of tramosASuperar) {
          tramo.activo = false;
          tramo.usuarioUltimaModificacion = user.usuario;
        }
        await queryRunner.manager.save(tramosASuperar);
      }

      const nuevas = createDto.filas.map((fila) =>
        queryRunner.manager.create(EscalaPrecioMineral, {
          idMineral: createDto.idMineral,
          ley: fila.ley,
          precioPunto: fila.precioPunto,
          precioTm: fila.precioTm,
          fechaVigenciaInicial: createDto.fechaVigenciaInicial,
          fechaVigenciaFinal: createDto.fechaVigenciaFinal,
          usuarioRegistro: user.usuario,
        }),
      );

      const guardadas = await queryRunner.manager.save(nuevas);
      await queryRunner.commitTransaction();
      return guardadas;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Actualiza en bloque uno o varios tramos, identificados cada uno por su "id".
   */
  async update(
    updateDto: UpdateEscalaPrecioMineralDto,
    user: Usuario,
  ): Promise<EscalaPrecioMineral[]> {
    const ids = updateDto.filas.map((f) => f.id);
    const tramos = await this.escalaPrecioRepository.find({
      where: { id: In(ids), activo: true },
    });

    if (tramos.length !== ids.length) {
      const encontrados = new Set(tramos.map((t) => t.id));
      const faltantes = ids.filter((id) => !encontrados.has(id));
      throw new NotFoundException(
        `No se encontraron los tramos con id: ${faltantes.join(', ')}.`,
      );
    }

    const ahora = new Date();
    const tramosPorId = new Map(tramos.map((t) => [t.id, t]));

    for (const fila of updateDto.filas) {
      const tramo = tramosPorId.get(fila.id)!;

      if (tramo.fechaVigenciaFinal && new Date(tramo.fechaVigenciaFinal) < ahora) {
        throw new BadRequestException(
          `El tramo con id ${fila.id} ya no se encuentra vigente y no puede modificarse.`,
        );
      }

      tramo.usuarioUltimaModificacion = user.usuario;
      if (fila.ley !== undefined) tramo.ley = fila.ley;
      if (fila.precioPunto !== undefined) tramo.precioPunto = fila.precioPunto;
      if (fila.precioTm !== undefined) tramo.precioTm = fila.precioTm;
      if (fila.fechaVigenciaInicial !== undefined)
        tramo.fechaVigenciaInicial = new Date(fila.fechaVigenciaInicial);
      if (fila.fechaVigenciaFinal !== undefined)
        tramo.fechaVigenciaFinal = new Date(fila.fechaVigenciaFinal);

      if (
        tramo.fechaVigenciaFinal &&
        new Date(tramo.fechaVigenciaFinal) <= new Date(tramo.fechaVigenciaInicial)
      ) {
        throw new BadRequestException(
          `El tramo con id ${fila.id}: la fecha de vigencia final no puede ser menor o igual a la inicial.`,
        );
      }
    }

    return await this.escalaPrecioRepository.save(tramos);
  }

  /**
   * Tabla de un mineral vigente en un instante dado (una fila por tramo de
   * ley, ordenada por ley). Si no se pasa "fecha", usa el instante actual.
   */
  async findVigenteByMineral(
    idMineral: number,
    fecha?: string,
  ): Promise<EscalaPrecioMineral[]> {
    const instante = fecha ? this.inicioDeDiaBolivia(fecha) : new Date();

    if (isNaN(instante.getTime())) {
      throw new BadRequestException('La fecha indicada no es válida.');
    }

    const filas = await this.escalaPrecioRepository
      .createQueryBuilder('escala')
      .where('escala.idMineral = :idMineral', { idMineral })
      .andWhere('escala.activo = true')
      .andWhere(
        ':instante >= escala.fechaVigenciaInicial AND (escala.fechaVigenciaFinal IS NULL OR :instante <= escala.fechaVigenciaFinal)',
        { instante },
      )
      .orderBy('escala.ley', 'ASC')
      .getMany();

    if (!filas.length) {
      throw new NotFoundException(
        fecha
          ? 'El mineral no tenía una tabla de precios vigente en la fecha indicada.'
          : 'El mineral no tiene una tabla de precios vigente en este momento.',
      );
    }

    return filas;
  }

  /**
   * Convierte una fecha calendario ("YYYY-MM-DD") en el instante correspondiente
   * al inicio de ese día (00:00:00.000) en hora de Bolivia (UTC-4 fijo). Si ya
   * viene con hora/offset (ISO completo), se respeta tal cual.
   */
  private inicioDeDiaBolivia(fecha: string): Date {
    const esSoloFecha = /^\d{4}-\d{2}-\d{2}$/.test(fecha);
    return esSoloFecha
      ? new Date(`${fecha}T00:00:00.000${OFFSET_BOLIVIA}`)
      : new Date(fecha);
  }
}
