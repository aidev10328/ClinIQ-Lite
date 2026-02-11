import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ManagerService } from './manager.service';
import { CreateDoctorDto, UpdateDoctorDto, CreateStaffDto, UpdateStaffDto } from './manager.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ClinicGuard } from '../../common/guards/clinic.guard';
import { ManagerGuard } from '../../common/guards/manager.guard';

@Controller('v1/manager')
@UseGuards(JwtAuthGuard, ClinicGuard, ManagerGuard)
export class ManagerController {
  constructor(private managerService: ManagerService) {}

  // ============================================
  // Clinic Stats
  // ============================================

  // GET /v1/manager/stats - Get clinic statistics
  @Get('stats')
  async getStats(@Request() req: any) {
    return this.managerService.getClinicStats(req.clinicId);
  }

  // ============================================
  // Doctor Management
  // ============================================

  // GET /v1/manager/doctors - List all doctors
  @Get('doctors')
  async listDoctors(@Request() req: any) {
    return this.managerService.listDoctors(req.clinicId);
  }

  // GET /v1/manager/doctors/:id - Get single doctor
  @Get('doctors/:id')
  async getDoctor(@Request() req: any, @Param('id') doctorId: string) {
    return this.managerService.getDoctor(req.clinicId, doctorId);
  }

  // POST /v1/manager/doctors - Create doctor
  @Post('doctors')
  async createDoctor(@Request() req: any, @Body() dto: CreateDoctorDto) {
    return this.managerService.createDoctor(req.clinicId, dto);
  }

  // PUT /v1/manager/doctors/:id - Update doctor
  @Put('doctors/:id')
  async updateDoctor(
    @Request() req: any,
    @Param('id') doctorId: string,
    @Body() dto: UpdateDoctorDto,
  ) {
    return this.managerService.updateDoctor(req.clinicId, doctorId, dto);
  }

  // DELETE /v1/manager/doctors/:id - Deactivate doctor
  @Delete('doctors/:id')
  async deactivateDoctor(@Request() req: any, @Param('id') doctorId: string) {
    return this.managerService.deactivateDoctor(req.clinicId, doctorId);
  }

  // ============================================
  // License Management
  // ============================================

  // GET /v1/manager/licenses - Get license info
  @Get('licenses')
  async getLicenseInfo(@Request() req: any) {
    return this.managerService.getLicenseInfo(req.clinicId);
  }

  // POST /v1/manager/doctors/:id/license - Assign license to doctor
  @Post('doctors/:id/license')
  async assignLicense(@Request() req: any, @Param('id') doctorId: string) {
    return this.managerService.assignLicense(req.clinicId, doctorId);
  }

  // DELETE /v1/manager/doctors/:id/license - Revoke license from doctor
  @Delete('doctors/:id/license')
  async revokeLicense(@Request() req: any, @Param('id') doctorId: string) {
    return this.managerService.revokeLicense(req.clinicId, doctorId);
  }

  // ============================================
  // Staff Management
  // ============================================

  // GET /v1/manager/staff - List all staff
  @Get('staff')
  async listStaff(@Request() req: any) {
    return this.managerService.listStaff(req.clinicId);
  }

  // POST /v1/manager/staff - Add staff member
  @Post('staff')
  async addStaff(@Request() req: any, @Body() dto: CreateStaffDto) {
    return this.managerService.addStaff(req.clinicId, dto);
  }

  // PUT /v1/manager/staff/:id - Update staff member
  @Put('staff/:id')
  async updateStaff(
    @Request() req: any,
    @Param('id') staffId: string,
    @Body() dto: UpdateStaffDto,
  ) {
    return this.managerService.updateStaff(req.clinicId, staffId, dto);
  }

  // DELETE /v1/manager/staff/:id - Remove staff member
  @Delete('staff/:id')
  async removeStaff(@Request() req: any, @Param('id') staffId: string) {
    return this.managerService.removeStaff(req.clinicId, staffId);
  }

  // ============================================
  // Staff Doctor Assignments
  // ============================================

  // GET /v1/manager/licensed-doctors - Get all licensed doctors for assignment selection
  @Get('licensed-doctors')
  async getLicensedDoctors(@Request() req: any) {
    return this.managerService.getLicensedDoctorsForAssignment(req.clinicId);
  }

  // GET /v1/manager/staff/:id/doctors - Get staff member's assigned doctors
  @Get('staff/:id/doctors')
  async getStaffDoctors(@Request() req: any, @Param('id') staffId: string) {
    return this.managerService.getStaffDoctorAssignments(req.clinicId, staffId);
  }

  // PUT /v1/manager/staff/:id/doctors - Update staff member's doctor assignments
  @Put('staff/:id/doctors')
  async updateStaffDoctors(
    @Request() req: any,
    @Param('id') staffId: string,
    @Body() body: { doctorIds: string[] },
  ) {
    return this.managerService.updateStaffDoctorAssignments(
      req.clinicId,
      staffId,
      body.doctorIds,
    );
  }
}
