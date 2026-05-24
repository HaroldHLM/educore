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
import { CreateInstitutionDto } from './dto/create-institution.dto';
import { QueryInstitutionsDto } from './dto/query-institutions.dto';
import { UpdateInstitutionDto } from './dto/update-institution.dto';
import {
  InstitutionResponse,
  PaginatedInstitutionsResponse,
} from './interfaces/institution-response.interface';
import { InstitutionsService } from './institutions.service';

@Controller('institutions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class InstitutionsController {
  constructor(private readonly institutionsService: InstitutionsService) {}

  @Post()
  create(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() createInstitutionDto: CreateInstitutionDto,
  ): Promise<InstitutionResponse> {
    return this.institutionsService.create(currentUser, createInstitutionDto);
  }

  @Get()
  findAll(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query() query: QueryInstitutionsDto,
  ): Promise<PaginatedInstitutionsResponse> {
    return this.institutionsService.findAll(currentUser, query);
  }

  @Get(':id')
  findOne(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<InstitutionResponse> {
    return this.institutionsService.findOne(currentUser, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') id: string,
    @Body() updateInstitutionDto: UpdateInstitutionDto,
  ): Promise<InstitutionResponse> {
    return this.institutionsService.update(
      currentUser,
      id,
      updateInstitutionDto,
    );
  }

  @Patch(':id/activate')
  activate(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<InstitutionResponse> {
    return this.institutionsService.activate(currentUser, id);
  }

  @Patch(':id/deactivate')
  deactivate(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<InstitutionResponse> {
    return this.institutionsService.deactivate(currentUser, id);
  }

  @Delete(':id')
  remove(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<InstitutionResponse> {
    return this.institutionsService.remove(currentUser, id);
  }
}
