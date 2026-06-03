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
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { QueryEnrollmentsDto } from './dto/query-enrollments.dto';
import { UpdateEnrollmentDto } from './dto/update-enrollment.dto';
import {
  EnrollmentResponse,
  PaginatedEnrollmentsResponse,
} from './interfaces/enrollment-response.interface';
import { EnrollmentsService } from './enrollments.service';

@Controller('enrollments')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class EnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  @Post()
  @Roles(Role.INSTITUTION_ADMIN)
  create(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() createEnrollmentDto: CreateEnrollmentDto,
  ): Promise<EnrollmentResponse> {
    return this.enrollmentsService.create(currentUser, createEnrollmentDto);
  }

  @Get()
  @Roles(Role.INSTITUTION_ADMIN, Role.TEACHER)
  findAll(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query() query: QueryEnrollmentsDto,
  ): Promise<PaginatedEnrollmentsResponse> {
    return this.enrollmentsService.findAll(currentUser, query);
  }

  @Get(':id')
  @Roles(Role.INSTITUTION_ADMIN, Role.TEACHER)
  findOne(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<EnrollmentResponse> {
    return this.enrollmentsService.findOne(currentUser, id);
  }

  @Patch(':id')
  @Roles(Role.INSTITUTION_ADMIN)
  update(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') id: string,
    @Body() updateEnrollmentDto: UpdateEnrollmentDto,
  ): Promise<EnrollmentResponse> {
    return this.enrollmentsService.update(currentUser, id, updateEnrollmentDto);
  }

  @Patch(':id/deactivate')
  @Roles(Role.INSTITUTION_ADMIN)
  deactivate(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<EnrollmentResponse> {
    return this.enrollmentsService.deactivate(currentUser, id);
  }

  @Delete(':id')
  @Roles(Role.INSTITUTION_ADMIN)
  remove(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<EnrollmentResponse> {
    return this.enrollmentsService.remove(currentUser, id);
  }
}
