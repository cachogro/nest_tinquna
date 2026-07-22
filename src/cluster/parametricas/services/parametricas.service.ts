import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TipoDocumento } from '../entities/tipo_documento.entity';
import { LugarEmisionDocumento } from '../entities/lugar_emision_documento.entity';
import { Repository } from 'typeorm';
import {
  EmisionDocumentoResponseDto,
  TipoDocumentoResponseDto,
} from '../dto/parametrica-response.dto';
import { Mineral } from '../entities/mineral.entity';
import { PersonaTipo } from '../entities/persona-tipo.entity';
import { TipoActorProductivoMinero } from '../entities/tipo-actor-productivo-minero.entity';

@Injectable()
export class ParametricasService {
  constructor(
    @InjectRepository(TipoDocumento, 'ci')
    private readonly tipoDocumentoRepository: Repository<TipoDocumento>,

    @InjectRepository(LugarEmisionDocumento, 'ci')
    private readonly lugarEmisionRepository: Repository<LugarEmisionDocumento>,

    @InjectRepository(Mineral, 'ci')
    private readonly mineralRepository: Repository<Mineral>,

    @InjectRepository(PersonaTipo, 'ci')
    private readonly personaTipoRepository: Repository<PersonaTipo>,

    @InjectRepository(TipoActorProductivoMinero, 'ci')
    private readonly TipoActorMineroRepository: Repository<TipoActorProductivoMinero>,
  ) {}

  async findAllTipoDocumentos(): Promise<TipoDocumentoResponseDto[]> {
    const tipoDocumentos = await this.tipoDocumentoRepository.find();
    return tipoDocumentos.map((td) => ({
      id: td.id,
      nombre: td.codigo,
    }));
  }

  async findAllLugaresEmision(): Promise<EmisionDocumentoResponseDto[]> {
    const lugaresEmision = await this.lugarEmisionRepository.find();
    return lugaresEmision.map((le) => ({
      id: le.id,
      nombre: le.codigo,
    }));
  }

  async findAllMinerales(): Promise<Mineral[]> {
    const allminerales = await this.mineralRepository.find({
      order: {
        id: 'ASC',
      },
    });
    return allminerales;
  }

  async findAllPersonaTipo(): Promise<PersonaTipo[]> {
    const allpersonaTipo = await this.personaTipoRepository.find({
      order: {
        id: 'ASC',
      },
    });
    return allpersonaTipo;
  }

  async findAlltipoActorPrdcMinero(): Promise<TipoActorProductivoMinero[]> {
    const allTipoMiinero = await this.TipoActorMineroRepository.find({
      where: { activo: true },
      order: { id: 'ASC' },
    });
    return allTipoMiinero;
  }
  
}
