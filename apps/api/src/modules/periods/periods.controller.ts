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
import { CreatePeriodDto } from './dto/create-period.dto';
import { QueryPeriodsDto } from './dto/query-periods.dto';
import { UpdatePeriodDto } from './dto/update-period.dto';
import {
  PaginatedPeriodsResponse,
  PeriodResponse,
} from './interfaces/period-response.interface';
import { PeriodsService } from './periods.service';

@Controller('periods')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class PeriodsController {
  constructor(private readonly periodsService: PeriodsService) {}

  @Post()
  @Roles(Role.INSTITUTION_ADMIN)
  create(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() createPeriodDto: CreatePeriodDto,
  ): Promise<PeriodResponse> {
    return this.periodsService.create(currentUser, createPeriodDto);
  }

  @Get()
  @Roles(Role.INSTITUTION_ADMIN, Role.TEACHER)
  findAll(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query() query: QueryPeriodsDto,
  ): Promise<PaginatedPeriodsResponse> {
    return this.periodsService.findAll(currentUser, query);
  }

  @Get(':id')
  @Roles(Role.INSTITUTION_ADMIN, Role.TEACHER)
  findOne(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<PeriodResponse> {
    return this.periodsService.findOne(currentUser, id);
  }

  @Patch(':id')
  @Roles(Role.INSTITUTION_ADMIN)
  update(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') id: string,
    @Body() updatePeriodDto: UpdatePeriodDto,
  ): Promise<PeriodResponse> {
    return this.periodsService.update(currentUser, id, updatePeriodDto);
  }

  @Delete(':id')
  @Roles(Role.INSTITUTION_ADMIN)
  remove(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<PeriodResponse> {
    return this.periodsService.remove(currentUser, id);
  }
}
