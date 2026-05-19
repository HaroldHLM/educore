import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async login(email: string, password: string, institutionSlug: string) {
    // 1. Buscar usuario
    const user = await this.prisma.user.findUnique({
      where: { email, isActive: true },
    });
    if (!user) throw new UnauthorizedException('Credenciales inválidas');

    // 2. Verificar contraseña
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new UnauthorizedException('Credenciales inválidas');

    // 3. Verificar membership en la institución
    const membership = await this.prisma.membership.findFirst({
      where: {
        userId: user.id,
        isActive: true,
        institution: { slug: institutionSlug, isActive: true },
      },
      include: { institution: true },
    });
    if (!membership) {
      throw new ForbiddenException('No tienes acceso a esta institución');
    }

    // 4. Generar tokens
    const tokens = await this.generateTokens(user.id, membership);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        avatar: user.avatar,
        role: membership.role,
        institution: {
          id: membership.institution.id,
          name: membership.institution.name,
          slug: membership.institution.slug,
          primaryColor: membership.institution.primaryColor,
        },
      },
    };
  }

  async refresh(token: string) {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { token },
      include: {
        user: {
          include: {
            memberships: {
              where: { isActive: true },
              include: { institution: true },
              take: 1,
            },
          },
        },
      },
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    const membership = stored.user.memberships[0];
    if (!membership) throw new ForbiddenException('Sin membresía activa');

    // Rotación: eliminar token viejo
    await this.prisma.refreshToken.delete({ where: { token } });

    // Generar nuevos tokens
    return this.generateTokens(stored.userId, membership);
  }

  async logout(token: string) {
    await this.prisma.refreshToken.deleteMany({ where: { token } });
    return { message: 'Sesión cerrada correctamente' };
  }

  async me(userId: string, institutionSlug: string) {
    const membership = await this.prisma.membership.findFirst({
      where: {
        userId,
        isActive: true,
        institution: { slug: institutionSlug },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
        institution: true,
      },
    });

    if (!membership) throw new NotFoundException('Usuario no encontrado');

    return {
      ...membership.user,
      role: membership.role,
      institution: {
        id: membership.institution.id,
        name: membership.institution.name,
        slug: membership.institution.slug,
        primaryColor: membership.institution.primaryColor,
        plan: membership.institution.plan,
      },
    };
  }

  private async generateTokens(userId: string, membership: any) {
    const payload = {
      sub: userId,
      institutionId: membership.institutionId,
      institutionSlug: membership.institution.slug,
      role: membership.role,
    };

    const accessToken = this.jwt.sign(payload, {
      expiresIn: this.config.get('JWT_EXPIRES_IN') ?? '15m',
    });

    // Refresh token opaco
    const rawToken = crypto.randomBytes(64).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.refreshToken.create({
      data: { token: rawToken, userId, expiresAt },
    });

    return { accessToken, refreshToken: rawToken };
  }
}