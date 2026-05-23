import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { PrismaService } from '../../database/prisma.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { QueryStudentsDto } from './dto/query-students.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import {
  PaginatedStudentsResponse,
  StudentResponse,
} from './interfaces/student-response.interface';

const studentSelect = {
  id: true,
  institutionId: true,
  code: true,
  firstName: true,
  lastName: true,
  birthDate: true,
  dni: true,
  email: true,
  phone: true,
  parentName: true,
  parentPhone: true,
  parentEmail: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.StudentSelect;

@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    currentUser: AuthenticatedUser,
    dto: CreateStudentDto,
  ): Promise<StudentResponse> {
    const institutionId = this.getInstitutionId(currentUser);
    const code = dto.code ?? (await this.generateStudentCode(institutionId));

    try {
      return await this.prisma.student.create({
        data: {
          institutionId,
          code,
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
          phone: dto.phone,
          dni: dto.dni,
          birthDate: dto.birthDate,
          parentName: dto.parentName,
          parentPhone: dto.parentPhone,
          parentEmail: dto.parentEmail,
        },
        select: studentSelect,
      });
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async findAll(
    currentUser: AuthenticatedUser,
    query: QueryStudentsDto,
  ): Promise<PaginatedStudentsResponse> {
    const institutionId = this.getInstitutionId(currentUser);
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const where = this.buildWhereClause(institutionId, query);

    const [students, total] = await this.prisma.$transaction([
      this.prisma.student.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        select: studentSelect,
      }),
      this.prisma.student.count({ where }),
    ]);

    return {
      data: students,
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
  ): Promise<StudentResponse> {
    const institutionId = this.getInstitutionId(currentUser);
    const student = await this.prisma.student.findFirst({
      where: { id, institutionId },
      select: studentSelect,
    });

    if (!student) {
      throw new NotFoundException('Estudiante no encontrado');
    }

    return student;
  }

  async update(
    currentUser: AuthenticatedUser,
    id: string,
    dto: UpdateStudentDto,
  ): Promise<StudentResponse> {
    const institutionId = this.getInstitutionId(currentUser);
    await this.ensureStudentExists(id, institutionId);

    try {
      return await this.prisma.student.update({
        where: { id },
        data: {
          code: dto.code,
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
          phone: dto.phone,
          dni: dto.dni,
          birthDate: dto.birthDate,
          parentName: dto.parentName,
          parentPhone: dto.parentPhone,
          parentEmail: dto.parentEmail,
          isActive: dto.isActive,
        },
        select: studentSelect,
      });
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async remove(
    currentUser: AuthenticatedUser,
    id: string,
  ): Promise<StudentResponse> {
    const institutionId = this.getInstitutionId(currentUser);
    await this.ensureStudentExists(id, institutionId);

    return this.prisma.student.update({
      where: { id },
      data: { isActive: false },
      select: studentSelect,
    });
  }

  private buildWhereClause(
    institutionId: string,
    query: QueryStudentsDto,
  ): Prisma.StudentWhereInput {
    const search = query.search?.trim();

    return {
      institutionId,
      ...(typeof query.isActive === 'boolean'
        ? { isActive: query.isActive }
        : {}),
      ...(search
        ? {
            OR: [
              { code: { contains: search, mode: 'insensitive' } },
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { dni: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
  }

  private async ensureStudentExists(
    id: string,
    institutionId: string,
  ): Promise<void> {
    const student = await this.prisma.student.findFirst({
      where: { id, institutionId },
      select: { id: true },
    });

    if (!student) {
      throw new NotFoundException('Estudiante no encontrado');
    }
  }

  private async generateStudentCode(institutionId: string): Promise<string> {
    const year = new Date().getFullYear();
    const studentCount = await this.prisma.student.count({
      where: { institutionId },
    });

    for (let offset = 1; offset <= 20; offset += 1) {
      const sequence = studentCount + offset;
      const code = `${year}${sequence.toString().padStart(4, '0')}`;
      const existing = await this.prisma.student.findUnique({
        where: { institutionId_code: { institutionId, code } },
        select: { id: true },
      });

      if (!existing) return code;
    }

    throw new ConflictException('No se pudo generar un código único');
  }

  private getInstitutionId(currentUser: AuthenticatedUser): string {
    if (!currentUser.institutionId) {
      throw new ForbiddenException('Institución no encontrada en el token');
    }

    return currentUser.institutionId;
  }

  private handlePrismaError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('Ya existe un estudiante con ese código');
    }

    throw error;
  }
}
