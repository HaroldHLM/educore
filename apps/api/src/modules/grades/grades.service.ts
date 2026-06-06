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
import { CreateGradeDto } from './dto/create-grade.dto';
import { QueryGradesDto } from './dto/query-grades.dto';
import { UpdateGradeDto } from './dto/update-grade.dto';
import {
  GradePeriodResponse,
  GradeResponse,
  GradeStudentResponse,
  GradeSubjectResponse,
  PaginatedGradesResponse,
} from './interfaces/grade-response.interface';

const gradeSelect = {
  id: true,
  institutionId: true,
  score: true,
  observation: true,
  gradedBy: true,
  gradedAt: true,
  updatedAt: true,
  student: {
    select: {
      id: true,
      institutionId: true,
      code: true,
      firstName: true,
      lastName: true,
    },
  },
  subject: {
    select: {
      id: true,
      name: true,
    },
  },
  period: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.GradeSelect;

const subjectTenantSelect = {
  id: true,
  courseId: true,
  isActive: true,
  course: {
    select: { institutionId: true },
  },
} satisfies Prisma.SubjectSelect;

type GradeWithRelations = Prisma.GradeGetPayload<{
  select: typeof gradeSelect;
}>;

type SubjectTenant = Prisma.SubjectGetPayload<{
  select: typeof subjectTenantSelect;
}>;

@Injectable()
export class GradesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    currentUser: AuthenticatedUser,
    dto: CreateGradeDto,
  ): Promise<GradeResponse> {
    const institutionId = this.getInstitutionId(currentUser);
    await this.ensureStudentBelongsToTenant(dto.studentId, institutionId);
    const subject = await this.ensureSubjectBelongsToTenant(
      dto.subjectId,
      institutionId,
    );
    await this.ensurePeriodBelongsToTenant(dto.periodId, institutionId);
    await this.ensureStudentIsEnrolledInSubjectCourse(
      dto.studentId,
      subject.courseId,
      institutionId,
    );

    try {
      const grade = await this.prisma.grade.create({
        data: {
          institutionId,
          studentId: dto.studentId,
          subjectId: dto.subjectId,
          periodId: dto.periodId,
          score: dto.score,
          observation: dto.observation,
          gradedBy: currentUser.id,
        },
        select: gradeSelect,
      });

      return this.toGradeResponse(grade);
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async findAll(
    currentUser: AuthenticatedUser,
    query: QueryGradesDto,
  ): Promise<PaginatedGradesResponse> {
    const institutionId = this.getInstitutionId(currentUser);
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const where = await this.buildWhereClause(institutionId, query);

    const [grades, total] = await this.prisma.$transaction([
      this.prisma.grade.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ gradedAt: 'desc' }, { updatedAt: 'desc' }],
        select: gradeSelect,
      }),
      this.prisma.grade.count({ where }),
    ]);

    return {
      data: grades.map((grade) => this.toGradeResponse(grade)),
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
  ): Promise<GradeResponse> {
    const institutionId = this.getInstitutionId(currentUser);
    const grade = await this.ensureGradeExists(id, institutionId);

    return this.toGradeResponse(grade);
  }

  async update(
    currentUser: AuthenticatedUser,
    id: string,
    dto: UpdateGradeDto,
  ): Promise<GradeResponse> {
    const institutionId = this.getInstitutionId(currentUser);
    await this.ensureGradeExists(id, institutionId);

    try {
      const updatedGrade = await this.prisma.grade.update({
        where: { id },
        data: {
          score: dto.score,
          observation: dto.observation,
        },
        select: gradeSelect,
      });

      return this.toGradeResponse(updatedGrade);
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async remove(
    currentUser: AuthenticatedUser,
    id: string,
  ): Promise<GradeResponse> {
    const institutionId = this.getInstitutionId(currentUser);
    const grade = await this.ensureGradeExists(id, institutionId);

    await this.prisma.grade.delete({ where: { id } });

    return this.toGradeResponse(grade);
  }

  private async buildWhereClause(
    institutionId: string,
    query: QueryGradesDto,
  ): Promise<Prisma.GradeWhereInput> {
    if (query.studentId) {
      await this.ensureStudentBelongsToTenant(query.studentId, institutionId);
    }

    if (query.subjectId) {
      await this.ensureSubjectBelongsToTenant(query.subjectId, institutionId);
    }

    if (query.periodId) {
      await this.ensurePeriodBelongsToTenant(query.periodId, institutionId);
    }

    return {
      institutionId,
      student: { institutionId },
      subject: { course: { institutionId } },
      period: { institutionId },
      ...(query.studentId ? { studentId: query.studentId } : {}),
      ...(query.subjectId ? { subjectId: query.subjectId } : {}),
      ...(query.periodId ? { periodId: query.periodId } : {}),
    };
  }

  private async ensureGradeExists(
    id: string,
    institutionId: string,
  ): Promise<GradeWithRelations> {
    const grade = await this.prisma.grade.findFirst({
      where: {
        id,
        institutionId,
        student: { institutionId },
        subject: { course: { institutionId } },
        period: { institutionId },
      },
      select: gradeSelect,
    });

    if (!grade) {
      throw new NotFoundException('Nota no encontrada');
    }

    return grade;
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

  private async ensureSubjectBelongsToTenant(
    subjectId: string,
    institutionId: string,
  ): Promise<SubjectTenant> {
    const subject = await this.prisma.subject.findFirst({
      where: { id: subjectId, course: { institutionId } },
      select: subjectTenantSelect,
    });

    if (!subject) {
      throw new NotFoundException('Materia no encontrada');
    }

    if (!subject.isActive) {
      throw new BadRequestException('La materia no está activa');
    }

    return subject;
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

  private async ensureStudentIsEnrolledInSubjectCourse(
    studentId: string,
    courseId: string,
    institutionId: string,
  ): Promise<void> {
    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        studentId,
        courseId,
        institutionId,
        isActive: true,
      },
      select: { id: true },
    });

    if (!enrollment) {
      throw new BadRequestException(
        'El estudiante no tiene una matrícula activa en el aula de la materia',
      );
    }
  }

  private getInstitutionId(currentUser: AuthenticatedUser): string {
    if (!currentUser.institutionId) {
      throw new ForbiddenException('Institución no encontrada en el token');
    }

    return currentUser.institutionId;
  }

  private toGradeResponse(grade: GradeWithRelations): GradeResponse {
    return {
      id: grade.id,
      institutionId: grade.institutionId,
      score: grade.score,
      observation: grade.observation,
      gradedBy: grade.gradedBy,
      gradedAt: grade.gradedAt,
      updatedAt: grade.updatedAt,
      student: this.toStudentResponse(grade.student),
      subject: this.toSubjectResponse(grade.subject),
      period: this.toPeriodResponse(grade.period),
    };
  }

  private toStudentResponse(
    student: GradeWithRelations['student'],
  ): GradeStudentResponse {
    return {
      id: student.id,
      code: student.code,
      firstName: student.firstName,
      lastName: student.lastName,
    };
  }

  private toSubjectResponse(
    subject: GradeWithRelations['subject'],
  ): GradeSubjectResponse {
    return {
      id: subject.id,
      name: subject.name,
    };
  }

  private toPeriodResponse(
    period: GradeWithRelations['period'],
  ): GradePeriodResponse {
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
        'Ya existe una nota para este estudiante, materia y periodo',
      );
    }

    throw error;
  }
}
