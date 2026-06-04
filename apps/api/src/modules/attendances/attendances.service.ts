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
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { QueryAttendancesDto } from './dto/query-attendances.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import {
  AttendancePeriodResponse,
  AttendanceResponse,
  AttendanceStudentResponse,
  PaginatedAttendancesResponse,
} from './interfaces/attendance-response.interface';

const attendanceSelect = {
  id: true,
  institutionId: true,
  date: true,
  status: true,
  note: true,
  createdAt: true,
  student: {
    select: {
      id: true,
      institutionId: true,
      code: true,
      firstName: true,
      lastName: true,
      isActive: true,
    },
  },
  period: {
    select: {
      id: true,
      institutionId: true,
      name: true,
    },
  },
} satisfies Prisma.AttendanceSelect;

type AttendanceWithRelations = Prisma.AttendanceGetPayload<{
  select: typeof attendanceSelect;
}>;

@Injectable()
export class AttendancesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    currentUser: AuthenticatedUser,
    dto: CreateAttendanceDto,
  ): Promise<AttendanceResponse> {
    const institutionId = this.getInstitutionId(currentUser);
    await this.ensureStudentBelongsToTenant(dto.studentId, institutionId);
    await this.ensurePeriodBelongsToTenant(dto.periodId, institutionId);
    await this.ensureStudentHasActiveEnrollment(dto.studentId, institutionId);

    try {
      const attendance = await this.prisma.attendance.create({
        data: {
          institutionId,
          studentId: dto.studentId,
          periodId: dto.periodId,
          date: dto.date,
          status: dto.status,
          note: dto.note,
        },
        select: attendanceSelect,
      });

      return this.toAttendanceResponse(attendance);
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async findAll(
    currentUser: AuthenticatedUser,
    query: QueryAttendancesDto,
  ): Promise<PaginatedAttendancesResponse> {
    const institutionId = this.getInstitutionId(currentUser);
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const where = await this.buildWhereClause(institutionId, query);

    const [attendances, total] = await this.prisma.$transaction([
      this.prisma.attendance.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        select: attendanceSelect,
      }),
      this.prisma.attendance.count({ where }),
    ]);

    return {
      data: attendances.map((attendance) =>
        this.toAttendanceResponse(attendance),
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
  ): Promise<AttendanceResponse> {
    const institutionId = this.getInstitutionId(currentUser);
    const attendance = await this.ensureAttendanceExists(id, institutionId);

    return this.toAttendanceResponse(attendance);
  }

  async update(
    currentUser: AuthenticatedUser,
    id: string,
    dto: UpdateAttendanceDto,
  ): Promise<AttendanceResponse> {
    const institutionId = this.getInstitutionId(currentUser);
    await this.ensureAttendanceExists(id, institutionId);

    try {
      const updatedAttendance = await this.prisma.attendance.update({
        where: { id },
        data: {
          status: dto.status,
          note: dto.note,
        },
        select: attendanceSelect,
      });

      return this.toAttendanceResponse(updatedAttendance);
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async remove(
    currentUser: AuthenticatedUser,
    id: string,
  ): Promise<AttendanceResponse> {
    const institutionId = this.getInstitutionId(currentUser);
    const attendance = await this.ensureAttendanceExists(id, institutionId);

    await this.prisma.attendance.delete({ where: { id } });

    return this.toAttendanceResponse(attendance);
  }

  private async buildWhereClause(
    institutionId: string,
    query: QueryAttendancesDto,
  ): Promise<Prisma.AttendanceWhereInput> {
    if (query.studentId) {
      await this.ensureStudentBelongsToTenant(query.studentId, institutionId);
    }

    if (query.periodId) {
      await this.ensurePeriodBelongsToTenant(query.periodId, institutionId);
    }

    return {
      institutionId,
      student: { institutionId },
      period: { institutionId },
      ...(query.studentId ? { studentId: query.studentId } : {}),
      ...(query.periodId ? { periodId: query.periodId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.date ? { date: query.date } : {}),
    };
  }

  private async ensureAttendanceExists(
    id: string,
    institutionId: string,
  ): Promise<AttendanceWithRelations> {
    const attendance = await this.prisma.attendance.findFirst({
      where: {
        id,
        institutionId,
        student: { institutionId },
        period: { institutionId },
      },
      select: attendanceSelect,
    });

    if (!attendance) {
      throw new NotFoundException('Asistencia no encontrada');
    }

    return attendance;
  }

  private async ensureStudentBelongsToTenant(
    studentId: string,
    institutionId: string,
  ): Promise<void> {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, institutionId },
      select: { id: true, isActive: true },
    });

    if (!student) {
      throw new NotFoundException('Estudiante no encontrado');
    }

    if (!student.isActive) {
      throw new BadRequestException('El estudiante no está activo');
    }
  }

  private async ensurePeriodBelongsToTenant(
    periodId: string,
    institutionId: string,
  ): Promise<void> {
    const period = await this.prisma.period.findFirst({
      where: { id: periodId, institutionId },
      select: { id: true },
    });

    if (!period) {
      throw new NotFoundException('Periodo no encontrado');
    }
  }

  private async ensureStudentHasActiveEnrollment(
    studentId: string,
    institutionId: string,
  ): Promise<void> {
    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        studentId,
        institutionId,
        isActive: true,
      },
      select: { id: true },
    });

    if (!enrollment) {
      throw new BadRequestException(
        'El estudiante no tiene una matrícula activa',
      );
    }
  }

  private getInstitutionId(currentUser: AuthenticatedUser): string {
    if (!currentUser.institutionId) {
      throw new ForbiddenException('Institución no encontrada en el token');
    }

    return currentUser.institutionId;
  }

  private toAttendanceResponse(
    attendance: AttendanceWithRelations,
  ): AttendanceResponse {
    return {
      id: attendance.id,
      institutionId: attendance.institutionId,
      date: attendance.date,
      status: attendance.status,
      note: attendance.note,
      createdAt: attendance.createdAt,
      student: this.toStudentResponse(attendance.student),
      period: this.toPeriodResponse(attendance.period),
    };
  }

  private toStudentResponse(
    student: AttendanceWithRelations['student'],
  ): AttendanceStudentResponse {
    return {
      id: student.id,
      code: student.code,
      firstName: student.firstName,
      lastName: student.lastName,
    };
  }

  private toPeriodResponse(
    period: AttendanceWithRelations['period'],
  ): AttendancePeriodResponse {
    return {
      id: period.id,
      name: period.name,
    };
  }

  private handlePrismaError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'Ya existe una asistencia registrada para este estudiante en esa fecha',
      );
    }

    throw error;
  }
}
