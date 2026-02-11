import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PatientsService } from './patients.service';
import { SearchPatientsQueryDto, CreatePatientDto, UpdatePatientDto } from './patients.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ClinicGuard } from '../../common/guards/clinic.guard';
import { ClinicId, ClinicRoles } from '../../common/decorators/clinic.decorator';

@Controller('v1/patients')
@UseGuards(JwtAuthGuard, ClinicGuard)
export class PatientsController {
  constructor(private patientsService: PatientsService) {}

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
  async getPatient(@ClinicId() clinicId: string, @Param('id') id: string) {
    return this.patientsService.getPatient(clinicId, id);
  }

  // GET /v1/patients/:id/history - Get patient visit history (All roles can view)
  @Get(':id/history')
  @ClinicRoles('CLINIC_MANAGER', 'CLINIC_STAFF', 'CLINIC_DOCTOR')
  async getPatientHistory(@ClinicId() clinicId: string, @Param('id') id: string) {
    return this.patientsService.getPatientHistory(clinicId, id);
  }

  // POST /v1/patients - Create/upsert patient (Staff/Manager only)
  @Post()
  @ClinicRoles('CLINIC_MANAGER', 'CLINIC_STAFF')
  async createPatient(
    @ClinicId() clinicId: string,
    @Body() dto: CreatePatientDto,
  ) {
    return this.patientsService.upsertPatient(clinicId, dto);
  }

  // PATCH /v1/patients/:id - Update patient (Staff/Manager only)
  @Patch(':id')
  @ClinicRoles('CLINIC_MANAGER', 'CLINIC_STAFF')
  async updatePatient(
    @ClinicId() clinicId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePatientDto,
  ) {
    return this.patientsService.updatePatient(clinicId, id, dto);
  }
}
