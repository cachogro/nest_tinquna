import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import * as bcrypt from 'bcrypt';

import { JwtService } from '@nestjs/jwt';
import { UsuarioService } from './usuario.service';
import { Usuario } from '../entities/usuario.entity';
import { Rol } from '../entities/rol.entity';
import { Persona } from '../entities/persona.entity';
import { LoginUsuarioDto } from '../dto/auth/login-usuario.dto';
import { JwtPayload } from '../models/interfaces/jwt-payload';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Usuario, 'ci')
    private readonly usuarioRepository: Repository<Usuario>,
    @InjectRepository(Rol, 'ci')
    private readonly rolRepository: Repository<Rol>,
    private readonly jwtService: JwtService,
    @InjectRepository(Persona, 'ci')
    private readonly personaRepository: Repository<Persona>,

    private readonly $usuario: UsuarioService,

    private readonly $config: ConfigService,
  ) {}

  async login(loginUsuarioDto: LoginUsuarioDto): Promise<{
    //ciudadania: boolean;
    user: Usuario;
    token: string;
    refreshToken: string;
  }> {
    const { usuario, contrasena } = loginUsuarioDto;
    // console.log(loginUsuarioDto);
    const userLogged: Usuario = await this.usuarioRepository.findOne({
      where: { usuario: usuario },
      select: {
        usuario: true,
        contrasena: true,
        id: true,
        
        // estado: true,
        // primeraSession: true,
        // correoFacturacion: true,
      },
    });
    if (!userLogged)
      throw new BadRequestException('Credenciales no válidas (Usuario)');
    if (!bcrypt.compareSync(contrasena, userLogged.contrasena))
      throw new BadRequestException('Credenciales no válidas (Contraseña)');
    // if (!userLogged.estado)
    //   throw new BadRequestException(
    //     'Usuario inválido, contáctese con un administrador',
    //   );
    // console.log(userLogged);
    // if (userLogged.primeraSession) {
    //   throw new UnauthorizedException('Password change required');
    // }
    delete userLogged.contrasena;
    const { token, refreshToken } = this.getJwtTokens({ id: userLogged.id });
    return {
      user: userLogged,
      token,
      refreshToken,
    };
  }

  public getJwtTokens(payload: JwtPayload): {
    token: string;
    refreshToken: string;
  } {
    const token = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.$config.get('JWT_SECRET_REFRESH'),
      expiresIn: this.$config.get('JWT_EXPIRATION_REFRESH'),
    });
    return { token, refreshToken };
  }

  public async getUserById(id: string): Promise<Usuario> {
    const user = await this.usuarioRepository.findOneBy({ id });
    if (user) return user;
    throw new NotFoundException('Nomse ha encontrado al usuario');
  }
}
