import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { PrismaService } from '../../database/prisma.service';
import { CreatePeriodDto } from './dto/create-period.dto';
import { QueryPeriodsDto } from './dto/query-periods.dto';
import { UpdatePeriodDto } from './dto/update-period.dto';
import {
  PaginatedPeriodsResponse,
  PeriodResponse,
} from './interfaces/period-response.interface';

const periodSelect = {
  id: true,
  institutionId: true,
  name: true,
  startDate: true,
  endDate: true,
  isActive: true,
  createdAt: true,
  _count: {
    select: {
      grades: true,
      attendances: true,
    },
  },
} satisfies Prisma.PeriodSelect;

type PeriodWithCounts = Prisma.PeriodGetPayload<{
  select: typeof periodSelect;
}>;

@Injectable()
export class PeriodsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    currentUser: AuthenticatedUser,
    dto: CreatePeriodDto,
  ): Promise<PeriodResponse> {
    const institutionId = this.getInstitutionId(currentUser);
    this.ensureValidDateRange(dto.startDate, dto.endDate);
    await this.ensureNoOverlappingPeriod(
      institutionId,
      dto.startDate,
      dto.endDate,
    );

    return this.prisma.$transaction(async (tx) => {
      if (dto.isActive) {
        await this.deactivateAllPeriods(tx, institutionId);
      }

      const period = await tx.period.create({
        data: {
          institutionId,
          name: dto.name,
          startDate: dto.startDate,
          endDate: dto.endDate,
          isActive: dto.isActive ?? false,
        },
        select: periodSelect,
      });

      return this.toPeriodResponse(period);
    });
  }

  async findAll(
    currentUser: AuthenticatedUser,
    query: QueryPeriodsDto,
  ): Promise<PaginatedPeriodsResponse> {
    const institutionId = this.getInstitutionId(currentUser);
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const where = this.buildWhereClause(institutionId, query);

    const [periods, total] = await this.prisma.$transaction([
      this.prisma.period.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
        select: periodSelect,
      }),
      this.prisma.period.count({ where }),
    ]);

    return {
      data: periods.map((period) => this.toPeriodResponse(period)),
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
  ): Promise<PeriodResponse> {
    const institutionId = this.getInstitutionId(currentUser);
    const period = await this.ensurePeriodExists(id, institutionId);

    return this.toPeriodResponse(period);
  }

  async update(
    currentUser: AuthenticatedUser,
    id: string,
    dto: UpdatePeriodDto,
  ): Promise<PeriodResponse> {
    const institutionId = this.getInstitutionId(currentUser);
    const existing = await this.ensurePeriodExists(id, institutionId);

    const nextStartDate = dto.startDate ?? existing.startDate;
    const nextEndDate = dto.endDate ?? existing.endDate;
    this.ensureValidDateRange(nextStartDate, nextEndDate);

    const datesChanged =
      dto.startDate?.getTime() !== existing.startDate.getTime() ||
      dto.endDate?.getTime() !== existing.endDate.getTime();

    if (datesChanged) {
      await this.ensureNoOverlappingPeriod(
        institutionId,
        nextStartDate,
        nextEndDate,
        id,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.isActive === true) {
        await this.deactivateAllPeriods(tx, institutionId, id);
      }

      const updated = await tx.period.update({
        where: { id },
        data: {
          name: dto.name,
          startDate: dto.startDate,
          endDate: dto.endDate,
          isActive: dto.isActive,
        },
        select: periodSelect,
      });

      return this.toPeriodResponse(updated);
    });
  }

  async remove(
    currentUser: AuthenticatedUser,
    id: string,
  ): Promise<PeriodResponse> {
    const institutionId = this.getInstitutionId(currentUser);
    const period = await this.ensurePeriodExists(id, institutionId);

    if (period._count.grades > 0 || period._count.attendances > 0) {
      throw new ConflictException(
        'No se puede eliminar un periodo con notas o asistencias asociadas',
      );
    }

    const deleted = await this.prisma.period.delete({
      where: { id },
      select: periodSelect,
    });

    return this.toPeriodResponse(deleted);
  }

  private buildWhereClause(
    institutionId: string,
    query: QueryPeriodsDto,
  ): Prisma.PeriodWhereInput {
    const search = query.search?.trim();

    return {
      institutionId,
      ...(typeof query.isActive === 'boolean'
        ? { isActive: query.isActive }
        : {}),
      ...(search
        ? {
            OR: [{ name: { contains: search, mode: 'insensitive' } }],
          }
        : {}),
    };
  }

  private async ensurePeriodExists(
    id: string,
    institutionId: string,
  ): Promise<PeriodWithCounts> {
    const period = await this.prisma.period.findFirst({
      where: { id, institutionId },
      select: periodSelect,
    });

    if (!period) {
      throw new NotFoundException('Periodo no encontrado');
    }

    return period;
  }

  private ensureValidDateRange(startDate: Date, endDate: Date): void {
    if (startDate.getTime() > endDate.getTime()) {
      throw new BadRequestException(
        'La fecha de inicio no puede ser mayor a la fecha de fin',
      );
    }
  }

  private async ensureNoOverlappingPeriod(
    institutionId: string,
    startDate: Date,
    endDate: Date,
    excludePeriodId?: string,
  ): Promise<void> {
    const overlapping = await this.prisma.period.findFirst({
      where: {
        institutionId,
        ...(excludePeriodId ? { id: { not: excludePeriodId } } : {}),
        AND: [{ startDate: { lte: endDate } }, { endDate: { gte: startDate } }],
      },
      select: { id: true, name: true },
    });

    if (overlapping) {
      throw new ConflictException(
        `El periodo se superpone con uno existente (${overlapping.name})`,
      );
    }
  }

  private deactivateAllPeriods(
    tx: Prisma.TransactionClient,
    institutionId: string,
    excludePeriodId?: string,
  ): Promise<Prisma.BatchPayload> {
    return tx.period.updateMany({
      where: {
        institutionId,
        isActive: true,
        ...(excludePeriodId ? { id: { not: excludePeriodId } } : {}),
      },
      data: { isActive: false },
    });
  }

  private getInstitutionId(currentUser: AuthenticatedUser): string {
    if (!currentUser.institutionId) {
      throw new ForbiddenException('Institución no encontrada en el token');
    }

    return currentUser.institutionId;
  }

  private toPeriodResponse(period: PeriodWithCounts): PeriodResponse {
    return {
      id: period.id,
      institutionId: period.institutionId,
      name: period.name,
      startDate: period.startDate,
      endDate: period.endDate,
      isActive: period.isActive,
      createdAt: period.createdAt,
      totalGrades: period._count.grades,
      totalAttendances: period._count.attendances,
    };
  }
}
