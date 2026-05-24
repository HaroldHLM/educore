import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Plan, Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { PrismaService } from '../../database/prisma.service';
import { CreateInstitutionDto } from './dto/create-institution.dto';
import { QueryInstitutionsDto } from './dto/query-institutions.dto';
import { UpdateInstitutionDto } from './dto/update-institution.dto';
import {
  InstitutionAdminResponse,
  InstitutionResponse,
  PaginatedInstitutionsResponse,
} from './interfaces/institution-response.interface';

const institutionSelect = {
  id: true,
  name: true,
  slug: true,
  logo: true,
  primaryColor: true,
  domain: true,
  plan: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      students: true,
      teachers: true,
      courses: true,
    },
  },
} satisfies Prisma.InstitutionSelect;

type InstitutionWithCounts = Prisma.InstitutionGetPayload<{
  select: typeof institutionSelect;
}>;

@Injectable()
export class InstitutionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    currentUser: AuthenticatedUser,
    dto: CreateInstitutionDto,
  ): Promise<InstitutionResponse> {
    this.ensurePlatformAdmin(currentUser);
    await this.ensureInstitutionIsUnique(dto.slug, dto.domain);
    await this.ensureAdminEmailIsUnique(dto.admin.email);

    const hashedPassword = await bcrypt.hash(dto.admin.password, 12);
    const institution = await this.prisma.$transaction(async (tx) => {
      const createdInstitution = await tx.institution.create({
        data: {
          name: dto.name,
          slug: dto.slug,
          domain: dto.domain,
          logo: dto.logo,
          primaryColor: dto.primaryColor,
          plan: dto.plan ?? Plan.BASE,
        },
        select: institutionSelect,
      });

      const admin = await tx.user.create({
        data: {
          firstName: dto.admin.firstName,
          lastName: dto.admin.lastName,
          email: dto.admin.email,
          password: hashedPassword,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      });

      const membership = await tx.membership.create({
        data: {
          userId: admin.id,
          institutionId: createdInstitution.id,
          role: Role.INSTITUTION_ADMIN,
        },
        select: { role: true },
      });

      return {
        institution: createdInstitution,
        admin: {
          ...admin,
          role: membership.role,
        },
      };
    });

    return this.toInstitutionResponse(
      institution.institution,
      institution.admin,
    );
  }

  async findAll(
    currentUser: AuthenticatedUser,
    query: QueryInstitutionsDto,
  ): Promise<PaginatedInstitutionsResponse> {
    this.ensurePlatformAdmin(currentUser);

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const where = this.buildWhereClause(query);

    const [institutions, total] = await this.prisma.$transaction([
      this.prisma.institution.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ createdAt: 'desc' }, { name: 'asc' }],
        select: institutionSelect,
      }),
      this.prisma.institution.count({ where }),
    ]);

    return {
      data: institutions.map((institution) =>
        this.toInstitutionResponse(institution),
      ),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(
    currentUser: AuthenticatedUser,
    id: string,
  ): Promise<InstitutionResponse> {
    this.ensurePlatformAdmin(currentUser);
    const institution = await this.ensureInstitutionExists(id);

    return this.toInstitutionResponse(institution);
  }

  async update(
    currentUser: AuthenticatedUser,
    id: string,
    dto: UpdateInstitutionDto,
  ): Promise<InstitutionResponse> {
    this.ensurePlatformAdmin(currentUser);
    await this.ensureInstitutionExists(id);

    if (dto.slug || dto.domain) {
      await this.ensureInstitutionIsUnique(dto.slug, dto.domain, id);
    }

    const institution = await this.prisma.institution.update({
      where: { id },
      data: {
        name: dto.name,
        slug: dto.slug,
        domain: dto.domain,
        logo: dto.logo,
        primaryColor: dto.primaryColor,
        plan: dto.plan,
        isActive: dto.isActive,
      },
      select: institutionSelect,
    });

    return this.toInstitutionResponse(institution);
  }

  async remove(
    currentUser: AuthenticatedUser,
    id: string,
  ): Promise<InstitutionResponse> {
    this.ensurePlatformAdmin(currentUser);
    await this.ensureInstitutionExists(id);

    const institution = await this.prisma.institution.update({
      where: { id },
      data: { isActive: false },
      select: institutionSelect,
    });

    return this.toInstitutionResponse(institution);
  }

  async activate(
    currentUser: AuthenticatedUser,
    id: string,
  ): Promise<InstitutionResponse> {
    this.ensurePlatformAdmin(currentUser);
    await this.ensureInstitutionExists(id);

    const institution = await this.prisma.institution.update({
      where: { id },
      data: { isActive: true },
      select: institutionSelect,
    });

    return this.toInstitutionResponse(institution);
  }

  async deactivate(
    currentUser: AuthenticatedUser,
    id: string,
  ): Promise<InstitutionResponse> {
    return this.remove(currentUser, id);
  }

  private buildWhereClause(
    query: QueryInstitutionsDto,
  ): Prisma.InstitutionWhereInput {
    const search = query.search?.trim();

    return {
      ...(query.plan ? { plan: query.plan } : {}),
      ...(typeof query.isActive === 'boolean'
        ? { isActive: query.isActive }
        : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { slug: { contains: search, mode: 'insensitive' } },
              { domain: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
  }

  private async ensureInstitutionExists(
    id: string,
  ): Promise<InstitutionWithCounts> {
    const institution = await this.prisma.institution.findUnique({
      where: { id },
      select: institutionSelect,
    });

    if (!institution) {
      throw new NotFoundException('Institución no encontrada');
    }

    return institution;
  }

  private async ensureInstitutionIsUnique(
    slug?: string,
    domain?: string,
    excludeInstitutionId?: string,
  ): Promise<void> {
    if (!slug && !domain) return;

    const duplicatedInstitution = await this.prisma.institution.findFirst({
      where: {
        ...(excludeInstitutionId ? { id: { not: excludeInstitutionId } } : {}),
        OR: [...(slug ? [{ slug }] : []), ...(domain ? [{ domain }] : [])],
      },
      select: {
        slug: true,
        domain: true,
      },
    });

    if (!duplicatedInstitution) return;

    if (slug && duplicatedInstitution.slug === slug) {
      throw new ConflictException('Ya existe una institución con ese slug');
    }

    throw new ConflictException('Ya existe una institución con ese dominio');
  }

  private async ensureAdminEmailIsUnique(email: string): Promise<void> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      throw new ConflictException('Ya existe un usuario con ese email');
    }
  }

  private ensurePlatformAdmin(currentUser: AuthenticatedUser): void {
    if (currentUser.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Solo SUPER_ADMIN puede administrar tenants',
      );
    }
  }

  private toInstitutionResponse(
    institution: InstitutionWithCounts,
    admin?: InstitutionAdminResponse,
  ): InstitutionResponse {
    return {
      id: institution.id,
      name: institution.name,
      slug: institution.slug,
      logo: institution.logo,
      primaryColor: institution.primaryColor,
      domain: institution.domain,
      plan: institution.plan,
      isActive: institution.isActive,
      createdAt: institution.createdAt,
      updatedAt: institution.updatedAt,
      totalStudents: institution._count.students,
      totalTeachers: institution._count.teachers,
      totalCourses: institution._count.courses,
      ...(admin ? { admin } : {}),
    };
  }
}
