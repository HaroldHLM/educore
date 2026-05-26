import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { PrismaService } from '../../database/prisma.service';
import { AssignCoursesDto } from './dto/assign-courses.dto';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { QueryTeachersDto } from './dto/query-teachers.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';
import {
  PaginatedTeachersResponse,
  TeacherResponse,
} from './interfaces/teacher-response.interface';

const teacherSelect = {
  id: true,
  institutionId: true,
  userId: true,
  specialty: true,
  isActive: true,
  createdAt: true,
  courses: {
    select: {
      course: {
        select: {
          id: true,
          grade: true,
          section: true,
          year: true,
        },
      },
    },
    orderBy: {
      course: {
        name: 'asc',
      },
    },
  },
  _count: {
    select: {
      courses: true,
    },
  },
} satisfies Prisma.TeacherSelect;

const teacherUserSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  avatar: true,
  isActive: true,
} satisfies Prisma.UserSelect;

type TeacherWithCourses = Prisma.TeacherGetPayload<{
  select: typeof teacherSelect;
}>;

type TeacherUser = Prisma.UserGetPayload<{
  select: typeof teacherUserSelect;
}>;

@Injectable()
export class TeachersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    currentUser: AuthenticatedUser,
    dto: CreateTeacherDto,
  ): Promise<TeacherResponse> {
    const institutionId = this.getInstitutionId(currentUser);
    await this.ensureEmailIsUnique(dto.email);

    const hashedPassword = await bcrypt.hash(dto.password, 12);
    const createdTeacher = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
          password: hashedPassword,
          avatar: dto.avatar,
        },
        select: teacherUserSelect,
      });

      await tx.membership.create({
        data: {
          userId: user.id,
          institutionId,
          role: Role.TEACHER,
        },
        select: { id: true },
      });

      const teacher = await tx.teacher.create({
        data: {
          institutionId,
          userId: user.id,
          specialty: dto.specialty,
        },
        select: teacherSelect,
      });

      return { teacher, user };
    });

    return this.toTeacherResponse(createdTeacher.teacher, createdTeacher.user);
  }

  async findAll(
    currentUser: AuthenticatedUser,
    query: QueryTeachersDto,
  ): Promise<PaginatedTeachersResponse> {
    const institutionId = this.getInstitutionId(currentUser);
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const where = await this.buildWhereClause(
      currentUser,
      institutionId,
      query,
    );

    const [teachers, total] = await this.prisma.$transaction([
      this.prisma.teacher.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ createdAt: 'desc' }],
        select: teacherSelect,
      }),
      this.prisma.teacher.count({ where }),
    ]);

    const users = await this.findUsersByIds(
      teachers.map((teacher) => teacher.userId),
    );

    return {
      data: teachers.map((teacher) =>
        this.toTeacherResponse(
          teacher,
          this.getUserForTeacher(users, teacher.userId),
        ),
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
  ): Promise<TeacherResponse> {
    const institutionId = this.getInstitutionId(currentUser);
    const teacher = await this.ensureTeacherExists(id, institutionId);
    this.ensureTeacherCanAccess(currentUser, teacher);

    const user = await this.ensureUserExists(teacher.userId);

    return this.toTeacherResponse(teacher, user);
  }

  async update(
    currentUser: AuthenticatedUser,
    id: string,
    dto: UpdateTeacherDto,
  ): Promise<TeacherResponse> {
    const institutionId = this.getInstitutionId(currentUser);
    const teacher = await this.ensureTeacherExists(id, institutionId);

    if (dto.email) {
      await this.ensureEmailIsUnique(dto.email, teacher.userId);
    }

    const password = dto.password
      ? await bcrypt.hash(dto.password, 12)
      : undefined;
    const updatedTeacher = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: teacher.userId },
        data: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
          password,
          avatar: dto.avatar,
          isActive: dto.isActive,
        },
        select: teacherUserSelect,
      });

      const updated = await tx.teacher.update({
        where: { id },
        data: {
          specialty: dto.specialty,
          isActive: dto.isActive,
        },
        select: teacherSelect,
      });

      if (typeof dto.isActive === 'boolean') {
        await tx.membership.updateMany({
          where: {
            userId: teacher.userId,
            institutionId,
            role: Role.TEACHER,
          },
          data: { isActive: dto.isActive },
        });
      }

      return { teacher: updated, user };
    });

    return this.toTeacherResponse(updatedTeacher.teacher, updatedTeacher.user);
  }

  async remove(
    currentUser: AuthenticatedUser,
    id: string,
  ): Promise<TeacherResponse> {
    const institutionId = this.getInstitutionId(currentUser);
    const teacher = await this.ensureTeacherExists(id, institutionId);

    const deletedTeacher = await this.prisma.$transaction(async (tx) => {
      const updatedTeacher = await tx.teacher.update({
        where: { id },
        data: { isActive: false },
        select: teacherSelect,
      });

      const user = await tx.user.update({
        where: { id: teacher.userId },
        data: { isActive: false },
        select: teacherUserSelect,
      });

      await tx.membership.updateMany({
        where: {
          userId: teacher.userId,
          institutionId,
          role: Role.TEACHER,
        },
        data: { isActive: false },
      });

      return { teacher: updatedTeacher, user };
    });

    return this.toTeacherResponse(deletedTeacher.teacher, deletedTeacher.user);
  }

  async assignCourses(
    currentUser: AuthenticatedUser,
    id: string,
    dto: AssignCoursesDto,
  ): Promise<TeacherResponse> {
    const institutionId = this.getInstitutionId(currentUser);
    const teacher = await this.ensureTeacherExists(id, institutionId);
    const courseIds = [...new Set(dto.courseIds)];

    if (courseIds.length !== dto.courseIds.length) {
      throw new BadRequestException('La lista de cursos contiene duplicados');
    }

    const courses = await this.prisma.course.findMany({
      where: {
        id: { in: courseIds },
        institutionId,
      },
      select: { id: true },
    });

    if (courses.length !== courseIds.length) {
      throw new BadRequestException(
        'Uno o más cursos no existen o no pertenecen a esta institución',
      );
    }

    const assignedTeacher = await this.prisma.$transaction(async (tx) => {
      await tx.courseTeacher.createMany({
        data: courseIds.map((courseId) => ({
          courseId,
          teacherId: teacher.id,
        })),
        skipDuplicates: true,
      });

      return tx.teacher.findFirst({
        where: { id, institutionId },
        select: teacherSelect,
      });
    });

    if (!assignedTeacher) {
      throw new NotFoundException('Profesor no encontrado');
    }

    const user = await this.ensureUserExists(assignedTeacher.userId);

    return this.toTeacherResponse(assignedTeacher, user);
  }

  private async buildWhereClause(
    currentUser: AuthenticatedUser,
    institutionId: string,
    query: QueryTeachersDto,
  ): Promise<Prisma.TeacherWhereInput> {
    const search = query.search?.trim();
    const matchingUserIds = search
      ? await this.findMatchingUserIds(search)
      : undefined;

    return {
      institutionId,
      ...(currentUser.role === Role.TEACHER ? { userId: currentUser.id } : {}),
      ...(typeof query.isActive === 'boolean'
        ? { isActive: query.isActive }
        : {}),
      ...(query.specialty
        ? { specialty: { contains: query.specialty, mode: 'insensitive' } }
        : {}),
      ...(search
        ? {
            OR: [
              { specialty: { contains: search, mode: 'insensitive' } },
              { userId: { in: matchingUserIds ?? [] } },
            ],
          }
        : {}),
    };
  }

  private async findMatchingUserIds(search: string): Promise<string[]> {
    const users = await this.prisma.user.findMany({
      where: {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    });

    return users.map((user) => user.id);
  }

  private async ensureTeacherExists(
    id: string,
    institutionId: string,
  ): Promise<TeacherWithCourses> {
    const teacher = await this.prisma.teacher.findFirst({
      where: { id, institutionId },
      select: teacherSelect,
    });

    if (!teacher) {
      throw new NotFoundException('Profesor no encontrado');
    }

    return teacher;
  }

  private async ensureUserExists(userId: string): Promise<TeacherUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: teacherUserSelect,
    });

    if (!user) {
      throw new NotFoundException('Usuario del profesor no encontrado');
    }

    return user;
  }

  private async findUsersByIds(userIds: string[]): Promise<TeacherUser[]> {
    if (userIds.length === 0) return [];

    return this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: teacherUserSelect,
    });
  }

  private getUserForTeacher(users: TeacherUser[], userId: string): TeacherUser {
    const user = users.find((item) => item.id === userId);

    if (!user) {
      throw new NotFoundException('Usuario del profesor no encontrado');
    }

    return user;
  }

  private async ensureEmailIsUnique(
    email: string,
    excludeUserId?: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (user && user.id !== excludeUserId) {
      throw new ConflictException('Ya existe un usuario con ese email');
    }
  }

  private ensureTeacherCanAccess(
    currentUser: AuthenticatedUser,
    teacher: TeacherWithCourses,
  ): void {
    if (
      currentUser.role === Role.TEACHER &&
      teacher.userId !== currentUser.id
    ) {
      throw new ForbiddenException('No puedes acceder a otro profesor');
    }
  }

  private getInstitutionId(currentUser: AuthenticatedUser): string {
    if (!currentUser.institutionId) {
      throw new ForbiddenException('Institución no encontrada en el token');
    }

    return currentUser.institutionId;
  }

  private toTeacherResponse(
    teacher: TeacherWithCourses,
    user: TeacherUser,
  ): TeacherResponse {
    return {
      id: teacher.id,
      institutionId: teacher.institutionId,
      userId: teacher.userId,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      avatar: user.avatar,
      specialty: teacher.specialty,
      isActive: teacher.isActive,
      userIsActive: user.isActive,
      createdAt: teacher.createdAt,
      totalCourses: teacher._count.courses,
      courses: teacher.courses.map(({ course }) => ({
        id: course.id,
        displayName: this.buildCourseDisplayName(course),
        grade: course.grade,
        section: course.section,
        year: course.year,
      })),
    };
  }

  private buildCourseDisplayName(
    course: Pick<
      TeacherWithCourses['courses'][number]['course'],
      'grade' | 'section' | 'year'
    >,
  ): string {
    return `${course.grade} ${course.section} - ${course.year}`;
  }
}
