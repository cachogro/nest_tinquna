import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Municipio } from '../entities/municipio.entity';

@Injectable()
export class MunicipioService {
  constructor(
    @InjectRepository(Municipio, 'ci')
    private readonly municipioRepository: Repository<Municipio>,
  ) {}

  async findAll(): Promise<Municipio[]> {
    return await this.municipioRepository.find({ where: { activo: true } });
  }
}
