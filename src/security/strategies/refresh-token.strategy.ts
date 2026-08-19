import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { Usuario } from '../entities/usuario.entity';
import { JwtPayload } from '../models/interfaces/jwt-payload';

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(
    @InjectRepository(Usuario, 'ci')
    private readonly usuarioRepository: Repository<Usuario>,

    configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.get('JWT_SECRET_REFRESH'),
    });
  }

  async validate(payload: JwtPayload): Promise<Usuario> {
    const { id } = payload;

    const usuario = await this.usuarioRepository.findOneBy({ id });

    if (!usuario) throw new BadRequestException('Token inválido');

    if (!usuario.activo)
      throw new BadRequestException(
        'El usuario está inactivo, habla con un administrador',
      );

    return usuario;
  }
}
