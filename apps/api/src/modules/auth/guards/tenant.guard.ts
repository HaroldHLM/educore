import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { TenantRequest } from '../../../common/interfaces/tenant-request.interface';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<TenantRequest>();
    const user = request.user;

    if (!user) throw new UnauthorizedException();

    const slug = request.headers['x-institution-slug'] as string;
    if (!slug)
      throw new ForbiddenException('Header x-institution-slug requerido');

    const membership = await this.prisma.membership.findFirst({
      where: {
        userId: user.id,
        isActive: true,
        institution: { slug, isActive: true },
      },
      include: { institution: true },
    });

    if (!membership) {
      throw new ForbiddenException('No tienes acceso a esta institución');
    }

    // Inyecta institución y rol en el request
    request.institution = membership.institution;
    user.role = membership.role;
    user.institutionId = membership.institutionId;
    user.institutionSlug = membership.institution.slug;

    return true;
  }
}
