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
import { AttendancesService } from './attendances.service';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { QueryAttendancesDto } from './dto/query-attendances.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import {
  AttendanceResponse,
  PaginatedAttendancesResponse,
} from './interfaces/attendance-response.interface';

@Controller('attendances')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class AttendancesController {
  constructor(private readonly attendancesService: AttendancesService) {}

  @Post()
  @Roles(Role.INSTITUTION_ADMIN, Role.TEACHER)
  create(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() createAttendanceDto: CreateAttendanceDto,
  ): Promise<AttendanceResponse> {
    return this.attendancesService.create(currentUser, createAttendanceDto);
  }

  @Get()
  @Roles(Role.INSTITUTION_ADMIN, Role.TEACHER)
  findAll(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query() query: QueryAttendancesDto,
  ): Promise<PaginatedAttendancesResponse> {
    return this.attendancesService.findAll(currentUser, query);
  }

  @Get(':id')
  @Roles(Role.INSTITUTION_ADMIN, Role.TEACHER)
  findOne(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<AttendanceResponse> {
    return this.attendancesService.findOne(currentUser, id);
  }

  @Patch(':id')
  @Roles(Role.INSTITUTION_ADMIN, Role.TEACHER)
  update(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') id: string,
    @Body() updateAttendanceDto: UpdateAttendanceDto,
  ): Promise<AttendanceResponse> {
    return this.attendancesService.update(currentUser, id, updateAttendanceDto);
  }

  @Delete(':id')
  @Roles(Role.INSTITUTION_ADMIN)
  remove(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<AttendanceResponse> {
    return this.attendancesService.remove(currentUser, id);
  }
}
