import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ClinicService } from './clinic.service';
import { PrismaService } from '../../prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ClinicGuard } from '../../common/guards/clinic.guard';
import { PlatformAdminGuard } from '../../common/guards/platform-admin.guard';
import { ClinicId, ClinicRole, ClinicRoles, CurrentUser } from '../../common/decorators/clinic.decorator';

// Clinic-scoped routes
@Controller('v1/clinic')
@UseGuards(JwtAuthGuard, ClinicGuard)
export class ClinicController {
  constructor(
    private clinicService: ClinicService,
    private prisma: PrismaService,
  ) {}

  // GET /v1/clinic/me - Get current clinic profile with role
  @Get('me')
  async getMyClinic(
    @ClinicId() clinicId: string,
    @ClinicRole() clinicRole: string,
    @CurrentUser() user: { id: string },
  ) {
    const clinic = await this.clinicService.getClinic(clinicId);

    // If user is a doctor, include their doctorId
    let doctorId: string | null = null;
    if (clinicRole === 'CLINIC_DOCTOR' || clinicRole === 'CLINIC_MANAGER') {
      const doctor = await this.prisma.doctor.findFirst({
        where: { clinicId, userId: user.id, isActive: true },
        select: { id: true },
      });
      doctorId = doctor?.id || null;
    }

    return { ...clinic, clinicRole, doctorId };
  }

  // GET /v1/clinic/time - Get current date/time in clinic timezone
  @Get('time')
  async getClinicTime(@ClinicId() clinicId: string) {
    return this.clinicService.getClinicTime(clinicId);
  }

  // PATCH /v1/clinic/me - Update clinic profile (manager only)
  @Patch('me')
  @ClinicRoles('CLINIC_MANAGER')
  async updateMyClinic(
    @ClinicId() clinicId: string,
    @Body() body: {
      name?: string;
      logoUrl?: string;
      phone?: string;
      address?: string;
      timezone?: string;
    },
  ) {
    return this.clinicService.updateClinic(clinicId, body);
  }
}

// Platform admin routes
@Controller('v1/platform/clinics')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class PlatformClinicController {
  constructor(private clinicService: ClinicService) {}

  // GET /v1/platform/clinics - List all clinics
  @Get()
  async listClinics() {
    return this.clinicService.listClinics();
  }

  // POST /v1/platform/clinics - Create clinic
  @Post()
  async createClinic(
    @Body() body: {
      name: string;
      phone?: string;
      address?: string;
      timezone?: string;
    },
  ) {
    return this.clinicService.createClinic(body);
  }

  // PATCH /v1/platform/clinics/:id - Update clinic
  @Patch(':id')
  async updateClinic(
    @Param('id') id: string,
    @Body() body: {
      name?: string;
      phone?: string;
      address?: string;
      timezone?: string;
      isActive?: boolean;
    },
  ) {
    return this.clinicService.platformUpdateClinic(id, body);
  }
}
