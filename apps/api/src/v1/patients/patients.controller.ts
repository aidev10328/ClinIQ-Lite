import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { PatientsService } from './patients.service';
import { SearchPatientsQueryDto, CreatePatientDto, UpdatePatientDto } from './patients.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ClinicGuard } from '../../common/guards/clinic.guard';
import { ClinicId, ClinicRoles, ClinicUserId, CurrentUser } from '../../common/decorators/clinic.decorator';
import { AuditService } from '../../common/services/audit.service';

@Controller('v1/patients')
@UseGuards(JwtAuthGuard, ClinicGuard)
export class PatientsController {
  constructor(
    private patientsService: PatientsService,
    private auditService: AuditService,
  ) {}

  // GET /v1/patients - Search patients (All roles can search)
  @Get()
  @ClinicRoles('CLINIC_MANAGER', 'CLINIC_STAFF', 'CLINIC_DOCTOR')
  async searchPatients(
    @ClinicId() clinicId: string,
    @Query() query: SearchPatientsQueryDto,
  ) {
    return this.patientsService.searchPatients(clinicId, query);
  }

  // GET /v1/patients/:id - Get patient details (All roles can view)
  @Get(':id')
  @ClinicRoles('CLINIC_MANAGER', 'CLINIC_STAFF', 'CLINIC_DOCTOR')
  async getPatient(
    @ClinicId() clinicId: string,
    @Param('id') id: string,
    @CurrentUser() user: { id: string; email: string },
    @ClinicUserId() clinicUserId: string | null,
    @Req() req: Request,
  ) {
    const result = await this.patientsService.getPatient(clinicId, id);

    // Audit log patient view (fire and forget)
    this.auditService.logPatientAccess(
      {
        userId: user.id,
        userEmail: user.email,
        clinicId,
        clinicUserId: clinicUserId || undefined,
        ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip,
        userAgent: req.headers['user-agent'],
      },
      id,
      'view',
    );

    return result;
  }

  // GET /v1/patients/:id/history - Get patient visit history (All roles can view)
  @Get(':id/history')
  @ClinicRoles('CLINIC_MANAGER', 'CLINIC_STAFF', 'CLINIC_DOCTOR')
  async getPatientHistory(
    @ClinicId() clinicId: string,
    @Param('id') id: string,
    @CurrentUser() user: { id: string; email: string },
    @ClinicUserId() clinicUserId: string | null,
    @Req() req: Request,
  ) {
    const result = await this.patientsService.getPatientHistory(clinicId, id);

    // Audit log patient history view (fire and forget)
    this.auditService.logPatientAccess(
      {
        userId: user.id,
        userEmail: user.email,
        clinicId,
        clinicUserId: clinicUserId || undefined,
        ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip,
        userAgent: req.headers['user-agent'],
      },
      id,
      'history',
    );

    return result;
  }

  // POST /v1/patients - Create/upsert patient (Staff/Manager only)
  @Post()
  @ClinicRoles('CLINIC_MANAGER', 'CLINIC_STAFF')
  async createPatient(
    @ClinicId() clinicId: string,
    @Body() dto: CreatePatientDto,
    @CurrentUser() user: { id: string; email: string },
    @ClinicUserId() clinicUserId: string | null,
    @Req() req: Request,
  ) {
    const result = await this.patientsService.upsertPatient(clinicId, dto);

    // Audit log patient create (fire and forget)
    this.auditService.logPatientAccess(
      {
        userId: user.id,
        userEmail: user.email,
        clinicId,
        clinicUserId: clinicUserId || undefined,
        ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip,
        userAgent: req.headers['user-agent'],
      },
      result.id,
      'create',
    );

    return result;
  }

  // PATCH /v1/patients/:id - Update patient (Staff/Manager only)
  @Patch(':id')
  @ClinicRoles('CLINIC_MANAGER', 'CLINIC_STAFF')
  async updatePatient(
    @ClinicId() clinicId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePatientDto,
    @CurrentUser() user: { id: string; email: string },
    @ClinicUserId() clinicUserId: string | null,
    @Req() req: Request,
  ) {
    const result = await this.patientsService.updatePatient(clinicId, id, dto);

    // Audit log patient update (fire and forget)
    this.auditService.logPatientAccess(
      {
        userId: user.id,
        userEmail: user.email,
        clinicId,
        clinicUserId: clinicUserId || undefined,
        ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip,
        userAgent: req.headers['user-agent'],
      },
      id,
      'update',
    );

    return result;
  }
}
