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
import { AssignCoursesDto } from './dto/assign-courses.dto';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { QueryTeachersDto } from './dto/query-teachers.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';
import {
  PaginatedTeachersResponse,
  TeacherResponse,
} from './interfaces/teacher-response.interface';
import { TeachersService } from './teachers.service';

@Controller('teachers')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class TeachersController {
  constructor(private readonly teachersService: TeachersService) {}

  @Post()
  @Roles(Role.INSTITUTION_ADMIN)
  create(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() createTeacherDto: CreateTeacherDto,
  ): Promise<TeacherResponse> {
    return this.teachersService.create(currentUser, createTeacherDto);
  }

  @Get()
  @Roles(Role.INSTITUTION_ADMIN, Role.TEACHER)
  findAll(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query() query: QueryTeachersDto,
  ): Promise<PaginatedTeachersResponse> {
    return this.teachersService.findAll(currentUser, query);
  }

  @Get(':id')
  @Roles(Role.INSTITUTION_ADMIN, Role.TEACHER)
  findOne(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<TeacherResponse> {
    return this.teachersService.findOne(currentUser, id);
  }

  @Patch(':id')
  @Roles(Role.INSTITUTION_ADMIN)
  update(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') id: string,
    @Body() updateTeacherDto: UpdateTeacherDto,
  ): Promise<TeacherResponse> {
    return this.teachersService.update(currentUser, id, updateTeacherDto);
  }

  @Delete(':id')
  @Roles(Role.INSTITUTION_ADMIN)
  remove(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<TeacherResponse> {
    return this.teachersService.remove(currentUser, id);
  }

  @Post(':id/courses')
  @Roles(Role.INSTITUTION_ADMIN)
  assignCourses(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') id: string,
    @Body() assignCoursesDto: AssignCoursesDto,
  ): Promise<TeacherResponse> {
    return this.teachersService.assignCourses(
      currentUser,
      id,
      assignCoursesDto,
    );
  }
}
