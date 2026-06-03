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
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { QueryEnrollmentsDto } from './dto/query-enrollments.dto';
import { UpdateEnrollmentDto } from './dto/update-enrollment.dto';
import {
  EnrollmentCourseResponse,
  EnrollmentResponse,
  EnrollmentStudentResponse,
  PaginatedEnrollmentsResponse,
} from './interfaces/enrollment-response.interface';

const enrollmentSelect = {
  id: true,
  institutionId: true,
  enrolledAt: true,
  withdrawnAt: true,
  isActive: true,
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
  course: {
    select: {
      id: true,
      institutionId: true,
      grade: true,
      section: true,
      year: true,
    },
  },
} satisfies Prisma.EnrollmentSelect;

type EnrollmentWithRelations = Prisma.EnrollmentGetPayload<{
  select: typeof enrollmentSelect;
}>;

@Injectable()
export class EnrollmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    currentUser: AuthenticatedUser,
    dto: CreateEnrollmentDto,
  ): Promise<EnrollmentResponse> {
    const institutionId = this.getInstitutionId(currentUser);
    await this.ensureStudentBelongsToTenant(dto.studentId, institutionId);
    await this.ensureCourseBelongsToTenant(dto.courseId, institutionId);
    await this.ensureEnrollmentDoesNotExist(dto.studentId, dto.courseId);

    try {
      const enrollment = await this.prisma.enrollment.create({
        data: {
          institutionId,
          studentId: dto.studentId,
          courseId: dto.courseId,
        },
        select: enrollmentSelect,
      });

      return this.toEnrollmentResponse(enrollment);
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async findAll(
    currentUser: AuthenticatedUser,
    query: QueryEnrollmentsDto,
  ): Promise<PaginatedEnrollmentsResponse> {
    const institutionId = this.getInstitutionId(currentUser);
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const where = await this.buildWhereClause(institutionId, query);

    const [enrollments, total] = await this.prisma.$transaction([
      this.prisma.enrollment.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ enrolledAt: 'desc' }],
        select: enrollmentSelect,
      }),
      this.prisma.enrollment.count({ where }),
    ]);

    return {
      data: enrollments.map((enrollment) =>
        this.toEnrollmentResponse(enrollment),
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
  ): Promise<EnrollmentResponse> {
    const institutionId = this.getInstitutionId(currentUser);
    const enrollment = await this.ensureEnrollmentExists(id, institutionId);

    return this.toEnrollmentResponse(enrollment);
  }

  async update(
    currentUser: AuthenticatedUser,
    id: string,
    dto: UpdateEnrollmentDto,
  ): Promise<EnrollmentResponse> {
    const institutionId = this.getInstitutionId(currentUser);
    const enrollment = await this.ensureEnrollmentExists(id, institutionId);

    if (dto.courseId) {
      await this.ensureCourseBelongsToTenant(dto.courseId, institutionId);
      await this.ensureEnrollmentDoesNotExist(
        enrollment.student.id,
        dto.courseId,
        id,
      );
    }

    if (dto.isActive === true) {
      await this.ensureStudentBelongsToTenant(
        enrollment.student.id,
        institutionId,
      );
      await this.ensureCourseBelongsToTenant(
        dto.courseId ?? enrollment.course.id,
        institutionId,
      );
    }

    try {
      const updatedEnrollment = await this.prisma.enrollment.update({
        where: { id },
        data: {
          courseId: dto.courseId,
          isActive: dto.isActive,
          withdrawnAt: this.getWithdrawnAt(dto.isActive),
        },
        select: enrollmentSelect,
      });

      return this.toEnrollmentResponse(updatedEnrollment);
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async deactivate(
    currentUser: AuthenticatedUser,
    id: string,
  ): Promise<EnrollmentResponse> {
    const institutionId = this.getInstitutionId(currentUser);
    await this.ensureEnrollmentExists(id, institutionId);

    const enrollment = await this.prisma.enrollment.update({
      where: { id },
      data: { isActive: false, withdrawnAt: new Date() },
      select: enrollmentSelect,
    });

    return this.toEnrollmentResponse(enrollment);
  }

  async remove(
    currentUser: AuthenticatedUser,
    id: string,
  ): Promise<EnrollmentResponse> {
    return this.deactivate(currentUser, id);
  }

  private async buildWhereClause(
    institutionId: string,
    query: QueryEnrollmentsDto,
  ): Promise<Prisma.EnrollmentWhereInput> {
    const search = query.search?.trim();

    if (query.studentId) {
      await this.ensureStudentBelongsToTenant(query.studentId, institutionId);
    }

    if (query.courseId) {
      await this.ensureCourseBelongsToTenant(query.courseId, institutionId);
    }

    return {
      institutionId,
      student: { institutionId },
      course: { institutionId },
      ...(query.studentId ? { studentId: query.studentId } : {}),
      ...(query.courseId ? { courseId: query.courseId } : {}),
      ...(typeof query.isActive === 'boolean'
        ? { isActive: query.isActive }
        : {}),
      ...(search
        ? {
            OR: [
              { student: { code: { contains: search, mode: 'insensitive' } } },
              {
                student: {
                  firstName: { contains: search, mode: 'insensitive' },
                },
              },
              {
                student: {
                  lastName: { contains: search, mode: 'insensitive' },
                },
              },
              { course: { grade: { contains: search, mode: 'insensitive' } } },
              {
                course: { section: { contains: search, mode: 'insensitive' } },
              },
              ...(Number.isNaN(Number(search))
                ? []
                : [{ course: { year: Number(search) } }]),
            ],
          }
        : {}),
    };
  }

  private async ensureEnrollmentExists(
    id: string,
    institutionId: string,
  ): Promise<EnrollmentWithRelations> {
    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        id,
        institutionId,
        student: { institutionId },
        course: { institutionId },
      },
      select: enrollmentSelect,
    });

    if (!enrollment) {
      throw new NotFoundException('Matrícula no encontrada');
    }

    return enrollment;
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

  private async ensureCourseBelongsToTenant(
    courseId: string,
    institutionId: string,
  ): Promise<void> {
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, institutionId },
      select: { id: true },
    });

    if (!course) {
      throw new NotFoundException('Curso no encontrado');
    }
  }

  private async ensureEnrollmentDoesNotExist(
    studentId: string,
    courseId: string,
    excludeEnrollmentId?: string,
  ): Promise<void> {
    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        studentId,
        courseId,
        ...(excludeEnrollmentId ? { id: { not: excludeEnrollmentId } } : {}),
      },
      select: { isActive: true },
    });

    if (!enrollment) return;

    if (enrollment.isActive) {
      throw new ConflictException(
        'Ya existe una matrícula activa para este estudiante y curso',
      );
    }

    throw new ConflictException(
      'Ya existe una matrícula para este estudiante y curso',
    );
  }

  private getInstitutionId(currentUser: AuthenticatedUser): string {
    if (!currentUser.institutionId) {
      throw new ForbiddenException('Institución no encontrada en el token');
    }

    return currentUser.institutionId;
  }

  private toEnrollmentResponse(
    enrollment: EnrollmentWithRelations,
  ): EnrollmentResponse {
    return {
      id: enrollment.id,
      institutionId: enrollment.institutionId,
      isActive: enrollment.isActive,
      enrolledAt: enrollment.enrolledAt,
      withdrawnAt: enrollment.withdrawnAt,
      student: this.toStudentResponse(enrollment.student),
      course: this.toCourseResponse(enrollment.course),
    };
  }

  private toStudentResponse(
    student: EnrollmentWithRelations['student'],
  ): EnrollmentStudentResponse {
    return {
      id: student.id,
      code: student.code,
      firstName: student.firstName,
      lastName: student.lastName,
    };
  }

  private toCourseResponse(
    course: EnrollmentWithRelations['course'],
  ): EnrollmentCourseResponse {
    return {
      id: course.id,
      grade: course.grade,
      section: course.section,
      year: course.year,
      displayName: this.buildCourseDisplayName(course),
    };
  }

  private buildCourseDisplayName(
    course: Pick<
      EnrollmentWithRelations['course'],
      'grade' | 'section' | 'year'
    >,
  ): string {
    return `${course.grade} ${course.section} - ${course.year}`;
  }

  private handlePrismaError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'Ya existe una matrícula para este estudiante y curso',
      );
    }

    throw error;
  }

  private getWithdrawnAt(
    isActive: boolean | undefined,
  ): Date | null | undefined {
    if (isActive === true) return null;
    if (isActive === false) return new Date();
    return undefined;
  }
}
