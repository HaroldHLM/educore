import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { PrismaService } from '../../database/prisma.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { QueryCoursesDto } from './dto/query-courses.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import {
  CourseResponse,
  PaginatedCoursesResponse,
} from './interfaces/course-response.interface';

const courseSelect = {
  id: true,
  institutionId: true,
  name: true,
  grade: true,
  section: true,
  year: true,
  createdAt: true,
  _count: {
    select: {
      enrollments: true,
      subjects: true,
    },
  },
} satisfies Prisma.CourseSelect;

type CourseWithCounts = Prisma.CourseGetPayload<{
  select: typeof courseSelect;
}>;

@Injectable()
export class CoursesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    currentUser: AuthenticatedUser,
    dto: CreateCourseDto,
  ): Promise<CourseResponse> {
    const institutionId = this.getInstitutionId(currentUser);
    await this.ensureCourseIsUnique(institutionId, dto);

    const course = await this.prisma.course.create({
      data: {
        institutionId,
        name: dto.name,
        grade: dto.grade,
        section: dto.section,
        year: dto.year,
      },
      select: courseSelect,
    });

    return this.toCourseResponse(course);
  }

  async findAll(
    currentUser: AuthenticatedUser,
    query: QueryCoursesDto,
  ): Promise<PaginatedCoursesResponse> {
    const institutionId = this.getInstitutionId(currentUser);
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const where = this.buildWhereClause(institutionId, query);

    const [courses, total] = await this.prisma.$transaction([
      this.prisma.course.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ year: 'desc' }, { grade: 'asc' }, { section: 'asc' }],
        select: courseSelect,
      }),
      this.prisma.course.count({ where }),
    ]);

    return {
      data: courses.map((course) => this.toCourseResponse(course)),
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
  ): Promise<CourseResponse> {
    const institutionId = this.getInstitutionId(currentUser);
    const course = await this.prisma.course.findFirst({
      where: { id, institutionId },
      select: courseSelect,
    });

    if (!course) {
      throw new NotFoundException('Curso no encontrado');
    }

    return this.toCourseResponse(course);
  }

  async update(
    currentUser: AuthenticatedUser,
    id: string,
    dto: UpdateCourseDto,
  ): Promise<CourseResponse> {
    const institutionId = this.getInstitutionId(currentUser);
    const existingCourse = await this.ensureCourseExists(id, institutionId);

    await this.ensureCourseIsUnique(
      institutionId,
      {
        grade: dto.grade ?? existingCourse.grade,
        section: dto.section ?? existingCourse.section,
        year: dto.year ?? existingCourse.year,
      },
      id,
    );

    const course = await this.prisma.course.update({
      where: { id },
      data: {
        name: dto.name,
        grade: dto.grade,
        section: dto.section,
        year: dto.year,
      },
      select: courseSelect,
    });

    return this.toCourseResponse(course);
  }

  async remove(
    currentUser: AuthenticatedUser,
    id: string,
  ): Promise<CourseResponse> {
    const institutionId = this.getInstitutionId(currentUser);
    const course = await this.ensureCourseExists(id, institutionId);

    if (course._count.enrollments > 0 || course._count.subjects > 0) {
      throw new ConflictException(
        'No se puede eliminar un curso con estudiantes o materias asociadas',
      );
    }

    const deletedCourse = await this.prisma.course.delete({
      where: { id },
      select: courseSelect,
    });

    return this.toCourseResponse(deletedCourse);
  }

  private buildWhereClause(
    institutionId: string,
    query: QueryCoursesDto,
  ): Prisma.CourseWhereInput {
    const search = query.search?.trim();

    return {
      institutionId,
      ...(typeof query.year === 'number' ? { year: query.year } : {}),
      ...(query.grade ? { grade: query.grade } : {}),
      ...(search
        ? {
            OR: [
              { grade: { contains: search, mode: 'insensitive' } },
              { section: { contains: search, mode: 'insensitive' } },
              ...(Number.isNaN(Number(search))
                ? []
                : [{ year: Number(search) }]),
            ],
          }
        : {}),
    };
  }

  private async ensureCourseExists(
    id: string,
    institutionId: string,
  ): Promise<CourseWithCounts> {
    const course = await this.prisma.course.findFirst({
      where: { id, institutionId },
      select: courseSelect,
    });

    if (!course) {
      throw new NotFoundException('Curso no encontrado');
    }

    return course;
  }

  private async ensureCourseIsUnique(
    institutionId: string,
    course: Pick<CreateCourseDto, 'grade' | 'section' | 'year'>,
    excludeCourseId?: string,
  ): Promise<void> {
    const duplicatedCourse = await this.prisma.course.findFirst({
      where: {
        institutionId,
        grade: course.grade,
        section: course.section,
        year: course.year,
        ...(excludeCourseId ? { id: { not: excludeCourseId } } : {}),
      },
      select: { id: true },
    });

    if (duplicatedCourse) {
      throw new ConflictException(
        'Ya existe un curso con el mismo grado, sección y año',
      );
    }
  }

  private getInstitutionId(currentUser: AuthenticatedUser): string {
    if (!currentUser.institutionId) {
      throw new ForbiddenException('Institución no encontrada en el token');
    }

    return currentUser.institutionId;
  }

  private toCourseResponse(course: CourseWithCounts): CourseResponse {
    return {
      id: course.id,
      institutionId: course.institutionId,
      name: course.name,
      displayName: this.buildDisplayName(course),
      grade: course.grade,
      section: course.section,
      year: course.year,
      createdAt: course.createdAt,
      totalStudents: course._count.enrollments,
      totalSubjects: course._count.subjects,
    };
  }

  private buildDisplayName(
    course: Pick<CourseWithCounts, 'grade' | 'section' | 'year'>,
  ): string {
    return `${course.grade} ${course.section} - ${course.year}`;
  }
}
