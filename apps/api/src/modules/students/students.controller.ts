import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { CreateStudentDto } from './dto/create-student.dto';
import { QueryStudentsDto } from './dto/query-students.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import {
  PaginatedStudentsResponse,
  StudentResponse,
} from './interfaces/student-response.interface';
import { StudentsService } from './students.service';

@Controller('students')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Post()
  @Roles(Role.INSTITUTION_ADMIN)
  create(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() createStudentDto: CreateStudentDto,
  ): Promise<StudentResponse> {
    return this.studentsService.create(currentUser, createStudentDto);
  }

  @Get()
  @Roles(Role.INSTITUTION_ADMIN, Role.TEACHER)
  findAll(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query() query: QueryStudentsDto,
  ): Promise<PaginatedStudentsResponse> {
    return this.studentsService.findAll(currentUser, query);
  }

  @Get(':id')
  @Roles(Role.INSTITUTION_ADMIN, Role.TEACHER)
  findOne(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<StudentResponse> {
    return this.studentsService.findOne(currentUser, id);
  }

  @Patch(':id')
  @Roles(Role.INSTITUTION_ADMIN)
  update(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') id: string,
    @Body() updateStudentDto: UpdateStudentDto,
  ): Promise<StudentResponse> {
    return this.studentsService.update(currentUser, id, updateStudentDto);
  }

  @Delete(':id')
  @Roles(Role.INSTITUTION_ADMIN)
  remove(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<StudentResponse> {
    return this.studentsService.remove(currentUser, id);
  }
}
