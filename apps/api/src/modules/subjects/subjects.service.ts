import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { PrismaService } from '../../database/prisma.service';
import { AssignTeacherDto } from './dto/assign-teacher.dto';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { QuerySubjectsDto } from './dto/query-subjects.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';
import {
  PaginatedSubjectsResponse,
  SubjectResponse,
  SubjectTeacherResponse,
} from './interfaces/subject-response.interface';

const subjectSelect = {
  id: true,
  courseId: true,
  teacherId: true,
  name: true,
  credits: true,
  weight: true,
  isActive: true,
  course: {
    select: {
      id: true,
      institutionId: true,
      grade: true,
      section: true,
      year: true,
    },
  },
  teacher: {
    select: {
      id: true,
      institutionId: true,
      userId: true,
      specialty: true,
    },
  },
  _count: {
    select: {
      grades: true,
    },
  },
} satisfies Prisma.SubjectSelect;

const teacherUserSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
} satisfies Prisma.UserSelect;

type SubjectWithRelations = Prisma.SubjectGetPayload<{
  select: typeof subjectSelect;
}>;

type TeacherUser = Prisma.UserGetPayload<{
  select: typeof teacherUserSelect;
}>;

@Injectable()
export class SubjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    currentUser: AuthenticatedUser,
    dto: CreateSubjectDto,
  ): Promise<SubjectResponse> {
    const institutionId = this.getInstitutionId(currentUser);
    await this.ensureCourseBelongsToTenant(dto.courseId, institutionId);
    await this.ensureSubjectNameIsUnique(dto.courseId, dto.name);

    if (dto.teacherId) {
      await this.ensureTeacherBelongsToTenant(dto.teacherId, institutionId);
    }

    const subject = await this.prisma.subject.create({
      data: {
        courseId: dto.courseId,
        teacherId: dto.teacherId,
        name: dto.name,
        credits: dto.credits,
        weight: dto.weight,
      },
      select: subjectSelect,
    });

    return this.toSubjectResponse(
      subject,
      await this.findTeacherUsers([subject]),
    );
  }

  async findAll(
    currentUser: AuthenticatedUser,
    query: QuerySubjectsDto,
  ): Promise<PaginatedSubjectsResponse> {
    const institutionId = this.getInstitutionId(currentUser);
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const where = await this.buildWhereClause(
      currentUser,
      institutionId,
      query,
    );

    const [subjects, total] = await this.prisma.$transaction([
      this.prisma.subject.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ course: { year: 'desc' } }, { name: 'asc' }],
        select: subjectSelect,
      }),
      this.prisma.subject.count({ where }),
    ]);
    const users = await this.findTeacherUsers(subjects);

    return {
      data: subjects.map((subject) => this.toSubjectResponse(subject, users)),
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
  ): Promise<SubjectResponse> {
    const institutionId = this.getInstitutionId(currentUser);
    const subject = await this.ensureSubjectExists(id, institutionId);
    this.ensureTeacherCanAccess(currentUser, subject);

    return this.toSubjectResponse(
      subject,
      await this.findTeacherUsers([subject]),
    );
  }

  async update(
    currentUser: AuthenticatedUser,
    id: string,
    dto: UpdateSubjectDto,
  ): Promise<SubjectResponse> {
    const institutionId = this.getInstitutionId(currentUser);
    const subject = await this.ensureSubjectExists(id, institutionId);
    const targetCourseId = dto.courseId ?? subject.courseId;

    if (dto.courseId) {
      await this.ensureCourseBelongsToTenant(dto.courseId, institutionId);
    }

    if (dto.name || dto.courseId) {
      await this.ensureSubjectNameIsUnique(
        targetCourseId,
        dto.name ?? subject.name,
        id,
      );
    }

    const updatedSubject = await this.prisma.subject.update({
      where: { id },
      data: {
        courseId: dto.courseId,
        name: dto.name,
        credits: dto.credits,
        weight: dto.weight,
        isActive: dto.isActive,
      },
      select: subjectSelect,
    });

    return this.toSubjectResponse(
      updatedSubject,
      await this.findTeacherUsers([updatedSubject]),
    );
  }

  async remove(
    currentUser: AuthenticatedUser,
    id: string,
  ): Promise<SubjectResponse> {
    const institutionId = this.getInstitutionId(currentUser);
    await this.ensureSubjectExists(id, institutionId);

    const subject = await this.prisma.subject.update({
      where: { id },
      data: { isActive: false },
      select: subjectSelect,
    });

    return this.toSubjectResponse(
      subject,
      await this.findTeacherUsers([subject]),
    );
  }

  async assignTeacher(
    currentUser: AuthenticatedUser,
    id: string,
    dto: AssignTeacherDto,
  ): Promise<SubjectResponse> {
    const institutionId = this.getInstitutionId(currentUser);
    await this.ensureSubjectExists(id, institutionId);

    if (dto.teacherId) {
      await this.ensureTeacherBelongsToTenant(dto.teacherId, institutionId);
    }

    const subject = await this.prisma.subject.update({
      where: { id },
      data: { teacherId: dto.teacherId },
      select: subjectSelect,
    });

    return this.toSubjectResponse(
      subject,
      await this.findTeacherUsers([subject]),
    );
  }

  private async buildWhereClause(
    currentUser: AuthenticatedUser,
    institutionId: string,
    query: QuerySubjectsDto,
  ): Promise<Prisma.SubjectWhereInput> {
    const search = query.search?.trim();
    const teacherScope = await this.buildTeacherScope(currentUser);

    if (query.courseId) {
      await this.ensureCourseBelongsToTenant(query.courseId, institutionId);
    }

    if (query.teacherId) {
      await this.ensureTeacherBelongsToTenant(query.teacherId, institutionId);
      if (
        currentUser.role === Role.TEACHER &&
        teacherScope.teacherId !== query.teacherId
      ) {
        throw new ForbiddenException(
          'No puedes consultar materias de otro profesor',
        );
      }
    }

    return {
      course: { institutionId },
      ...(query.courseId ? { courseId: query.courseId } : {}),
      ...(query.teacherId ? { teacherId: query.teacherId } : {}),
      ...(teacherScope.teacherId ? { teacherId: teacherScope.teacherId } : {}),
      ...(typeof query.isActive === 'boolean'
        ? { isActive: query.isActive }
        : {}),
      ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
    };
  }

  private async buildTeacherScope(
    currentUser: AuthenticatedUser,
  ): Promise<{ teacherId?: string }> {
    if (currentUser.role !== Role.TEACHER) return {};

    const teacher = await this.prisma.teacher.findFirst({
      where: {
        userId: currentUser.id,
        institutionId: currentUser.institutionId,
        isActive: true,
      },
      select: { id: true },
    });

    if (!teacher) {
      throw new ForbiddenException('Profesor no encontrado para este usuario');
    }

    return { teacherId: teacher.id };
  }

  private async ensureSubjectExists(
    id: string,
    institutionId: string,
  ): Promise<SubjectWithRelations> {
    const subject = await this.prisma.subject.findFirst({
      where: {
        id,
        course: { institutionId },
      },
      select: subjectSelect,
    });

    if (!subject) {
      throw new NotFoundException('Materia no encontrada');
    }

    return subject;
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
      throw new BadRequestException(
        'El curso no existe o no pertenece a esta institución',
      );
    }
  }

  private async ensureTeacherBelongsToTenant(
    teacherId: string,
    institutionId: string,
  ): Promise<void> {
    const teacher = await this.prisma.teacher.findFirst({
      where: { id: teacherId, institutionId, isActive: true },
      select: { id: true },
    });

    if (!teacher) {
      throw new BadRequestException(
        'El profesor no existe o no pertenece a esta institución',
      );
    }
  }

  private async ensureSubjectNameIsUnique(
    courseId: string,
    name: string,
    excludeSubjectId?: string,
  ): Promise<void> {
    const duplicatedSubject = await this.prisma.subject.findFirst({
      where: {
        courseId,
        name: { equals: name, mode: 'insensitive' },
        ...(excludeSubjectId ? { id: { not: excludeSubjectId } } : {}),
      },
      select: { id: true },
    });

    if (duplicatedSubject) {
      throw new ConflictException(
        'Ya existe una materia con ese nombre en el curso',
      );
    }
  }

  private async findTeacherUsers(
    subjects: SubjectWithRelations[],
  ): Promise<Map<string, TeacherUser>> {
    const userIds = [
      ...new Set(
        subjects
          .map((subject) => subject.teacher?.userId)
          .filter((userId): userId is string => Boolean(userId)),
      ),
    ];

    if (userIds.length === 0) return new Map<string, TeacherUser>();

    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: teacherUserSelect,
    });

    return new Map(users.map((user) => [user.id, user]));
  }

  private ensureTeacherCanAccess(
    currentUser: AuthenticatedUser,
    subject: SubjectWithRelations,
  ): void {
    if (currentUser.role !== Role.TEACHER) return;

    if (!subject.teacher || subject.teacher.userId !== currentUser.id) {
      throw new ForbiddenException(
        'No puedes acceder a materias de otro profesor',
      );
    }
  }

  private getInstitutionId(currentUser: AuthenticatedUser): string {
    if (!currentUser.institutionId) {
      throw new ForbiddenException('Institución no encontrada en el token');
    }

    return currentUser.institutionId;
  }

  private toSubjectResponse(
    subject: SubjectWithRelations,
    teacherUsers: Map<string, TeacherUser>,
  ): SubjectResponse {
    const teacher = subject.teacher
      ? this.toTeacherResponse(subject.teacher, teacherUsers)
      : null;

    return {
      id: subject.id,
      courseId: subject.courseId,
      teacherId: subject.teacherId,
      name: subject.name,
      credits: subject.credits,
      weight: subject.weight,
      isActive: subject.isActive,
      totalGrades: subject._count.grades,
      course: {
        id: subject.course.id,
        displayName: this.buildCourseDisplayName(subject.course),
        grade: subject.course.grade,
        section: subject.course.section,
        year: subject.course.year,
      },
      teacher,
    };
  }

  private buildCourseDisplayName(
    course: Pick<SubjectWithRelations['course'], 'grade' | 'section' | 'year'>,
  ): string {
    return `${course.grade} ${course.section} - ${course.year}`;
  }

  private toTeacherResponse(
    teacher: NonNullable<SubjectWithRelations['teacher']>,
    teacherUsers: Map<string, TeacherUser>,
  ): SubjectTeacherResponse {
    const user = teacherUsers.get(teacher.userId);

    if (!user) {
      throw new NotFoundException('Usuario del profesor no encontrado');
    }

    return {
      id: teacher.id,
      userId: teacher.userId,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      specialty: teacher.specialty,
    };
  }
}
