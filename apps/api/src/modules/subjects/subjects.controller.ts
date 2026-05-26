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
import { AssignTeacherDto } from './dto/assign-teacher.dto';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { QuerySubjectsDto } from './dto/query-subjects.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';
import {
  PaginatedSubjectsResponse,
  SubjectResponse,
} from './interfaces/subject-response.interface';
import { SubjectsService } from './subjects.service';

@Controller('subjects')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class SubjectsController {
  constructor(private readonly subjectsService: SubjectsService) {}

  @Post()
  @Roles(Role.INSTITUTION_ADMIN)
  create(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() createSubjectDto: CreateSubjectDto,
  ): Promise<SubjectResponse> {
    return this.subjectsService.create(currentUser, createSubjectDto);
  }

  @Get()
  @Roles(Role.INSTITUTION_ADMIN, Role.TEACHER)
  findAll(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query() query: QuerySubjectsDto,
  ): Promise<PaginatedSubjectsResponse> {
    return this.subjectsService.findAll(currentUser, query);
  }

  @Get(':id')
  @Roles(Role.INSTITUTION_ADMIN, Role.TEACHER)
  findOne(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<SubjectResponse> {
    return this.subjectsService.findOne(currentUser, id);
  }

  @Patch(':id')
  @Roles(Role.INSTITUTION_ADMIN)
  update(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') id: string,
    @Body() updateSubjectDto: UpdateSubjectDto,
  ): Promise<SubjectResponse> {
    return this.subjectsService.update(currentUser, id, updateSubjectDto);
  }

  @Delete(':id')
  @Roles(Role.INSTITUTION_ADMIN)
  remove(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<SubjectResponse> {
    return this.subjectsService.remove(currentUser, id);
  }

  @Patch(':id/teacher')
  @Roles(Role.INSTITUTION_ADMIN)
  assignTeacher(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') id: string,
    @Body() assignTeacherDto: AssignTeacherDto,
  ): Promise<SubjectResponse> {
    return this.subjectsService.assignTeacher(
      currentUser,
      id,
      assignTeacherDto,
    );
  }
}
