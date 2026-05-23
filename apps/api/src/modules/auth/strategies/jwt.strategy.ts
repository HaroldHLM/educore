import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../database/prisma.service';
import { AuthenticatedUser } from '../../../common/interfaces/authenticated-user.interface';

type JwtPayload = AuthenticatedUser & {
  sub: string;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub, isActive: true },
      select: {
        id: true,
      },
    });

    if (!user) throw new UnauthorizedException('Token inválido');

    return {
      id: user.id,
      institutionId: payload.institutionId,
      institutionSlug: payload.institutionSlug,
      role: payload.role,
    };
  }
}
