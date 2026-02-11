import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  AdminClinicsService,
  CreateClinicDto,
  UpdateClinicDto,
  CreateDoctorDto,
  UpdateDoctorDto,
  PurchaseLicensesDto,
  CreateManagerDto,
  UpdateStaffDto,
} from './admin-clinics.service';
import { AdminSlotsService } from './admin-slots.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';

@Controller('admin/clinics')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminClinicsController {
  constructor(
    private clinicsService: AdminClinicsService,
    private slotsService: AdminSlotsService,
  ) {}

  // GET /admin/clinics/countries - Get country config (phone codes, timezones)
  @Get('countries')
  getCountries() {
    return this.clinicsService.getCountryConfig();
  }

  // GET /admin/clinics - List all clinics
  @Get()
  async findAll() {
    return this.clinicsService.findAll();
  }

  // GET /admin/clinics/:id - Get single clinic
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.clinicsService.findOne(id);
  }

  // POST /admin/clinics - Create clinic
  @Post()
  async create(@Body() dto: CreateClinicDto) {
    return this.clinicsService.create(dto);
  }

  // PUT /admin/clinics/:id - Update clinic
  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateClinicDto) {
    return this.clinicsService.update(id, dto);
  }

  // DELETE /admin/clinics/:id - Deactivate clinic
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.clinicsService.remove(id);
  }

  // ============================================
  // Staff Management
  // ============================================

  // POST /admin/clinics/:id/staff - Add staff to clinic
  @Post(':id/staff')
  async addStaff(
    @Param('id') clinicId: string,
    @Body() body: { userId: string; role: 'CLINIC_MANAGER' | 'CLINIC_DOCTOR' | 'CLINIC_STAFF' },
  ) {
    return this.clinicsService.addStaff(clinicId, body.userId, body.role);
  }

  // DELETE /admin/clinics/:id/staff/:userId - Remove staff from clinic
  @Delete(':id/staff/:userId')
  async removeStaff(
    @Param('id') clinicId: string,
    @Param('userId') userId: string,
  ) {
    return this.clinicsService.removeStaff(clinicId, userId);
  }

  // PUT /admin/clinics/:id/staff/:staffId - Update staff member
  @Put(':id/staff/:staffId')
  async updateStaff(
    @Param('id') clinicId: string,
    @Param('staffId') staffId: string,
    @Body() dto: UpdateStaffDto,
  ) {
    return this.clinicsService.updateStaff(clinicId, staffId, dto);
  }

  // POST /admin/clinics/:id/managers - Create manager for clinic
  @Post(':id/managers')
  async createManager(
    @Param('id') clinicId: string,
    @Body() dto: CreateManagerDto,
  ) {
    return this.clinicsService.createManager(clinicId, dto);
  }

  // ============================================
  // Doctor Management
  // ============================================

  // POST /admin/clinics/:id/doctors - Create doctor
  @Post(':id/doctors')
  async createDoctor(
    @Param('id') clinicId: string,
    @Body() dto: CreateDoctorDto,
  ) {
    return this.clinicsService.createDoctor(clinicId, dto);
  }

  // PUT /admin/clinics/:id/doctors/:doctorId - Update doctor
  @Put(':id/doctors/:doctorId')
  async updateDoctor(
    @Param('id') clinicId: string,
    @Param('doctorId') doctorId: string,
    @Body() dto: UpdateDoctorDto,
  ) {
    return this.clinicsService.updateDoctor(clinicId, doctorId, dto);
  }

  // DELETE /admin/clinics/:id/doctors/:doctorId - Deactivate doctor
  @Delete(':id/doctors/:doctorId')
  async removeDoctor(
    @Param('id') clinicId: string,
    @Param('doctorId') doctorId: string,
  ) {
    return this.clinicsService.removeDoctor(clinicId, doctorId);
  }

  // ============================================
  // License Management
  // ============================================

  // POST /admin/clinics/:id/licenses/purchase - Purchase licenses
  @Post(':id/licenses/purchase')
  async purchaseLicenses(
    @Param('id') clinicId: string,
    @Body() dto: PurchaseLicensesDto,
  ) {
    return this.clinicsService.purchaseLicenses(clinicId, dto);
  }

  // GET /admin/clinics/:id/licenses - Get license purchase history
  @Get(':id/licenses')
  async getLicensePurchases(@Param('id') clinicId: string) {
    return this.clinicsService.getLicensePurchases(clinicId);
  }

  // POST /admin/clinics/:id/doctors/:doctorId/license - Assign license to doctor
  @Post(':id/doctors/:doctorId/license')
  async assignLicense(
    @Param('id') clinicId: string,
    @Param('doctorId') doctorId: string,
  ) {
    return this.clinicsService.assignLicense(clinicId, doctorId);
  }

  // DELETE /admin/clinics/:id/doctors/:doctorId/license - Revoke license from doctor
  @Delete(':id/doctors/:doctorId/license')
  async revokeLicense(
    @Param('id') clinicId: string,
    @Param('doctorId') doctorId: string,
  ) {
    return this.clinicsService.revokeLicense(clinicId, doctorId);
  }

  // ============================================
  // Slot Management
  // ============================================

  // GET /admin/clinics/:id/slots/status - Get slot status for all doctors
  @Get(':id/slots/status')
  async getClinicSlotStatus(@Param('id') clinicId: string) {
    return this.slotsService.getClinicSlotStatus(clinicId);
  }

  // POST /admin/clinics/:id/slots/generate - Bulk generate slots for all doctors
  @Post(':id/slots/generate')
  async bulkGenerateSlots(
    @Param('id') clinicId: string,
    @Body() body: { year?: number },
  ) {
    return this.slotsService.bulkGenerateSlotsForClinic(clinicId, body.year);
  }

  // POST /admin/clinics/:id/doctors/:doctorId/slots/generate - Generate slots for a specific doctor
  @Post(':id/doctors/:doctorId/slots/generate')
  async generateDoctorSlots(
    @Param('id') clinicId: string,
    @Param('doctorId') doctorId: string,
    @Body() body: { startDate?: string; endDate?: string },
  ) {
    return this.slotsService.generateSlotsForDoctor(
      clinicId,
      doctorId,
      body.startDate,
      body.endDate,
    );
  }

  // DELETE /admin/clinics/:id/doctors/:doctorId/slots - Clear future available slots
  @Delete(':id/doctors/:doctorId/slots')
  async clearDoctorSlots(
    @Param('id') clinicId: string,
    @Param('doctorId') doctorId: string,
  ) {
    return this.slotsService.clearFutureSlots(clinicId, doctorId);
  }
}
