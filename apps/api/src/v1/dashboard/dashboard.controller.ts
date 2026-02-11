import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ClinicGuard } from '../../common/guards/clinic.guard';
import { ClinicId, ClinicRoles, CurrentUser } from '../../common/decorators/clinic.decorator';

@Controller('v1/dashboard')
@UseGuards(JwtAuthGuard, ClinicGuard)
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  /**
   * GET /v1/dashboard/staff
   * Access: CLINIC_STAFF, CLINIC_MANAGER
   *
   * Returns daily overview for staff: scheduled appointments, queue status, waiting patients
   */
  @Get('staff')
  @ClinicRoles('CLINIC_STAFF', 'CLINIC_MANAGER')
  async getStaffDashboard(
    @ClinicId() clinicId: string,
    @Query('date') date: string,
    @Query('doctorId') doctorId?: string,
  ) {
    // Default to today if no date provided
    const queryDate = date || new Date().toISOString().split('T')[0];
    return this.dashboardService.getStaffDashboard(clinicId, queryDate, doctorId);
  }

  /**
   * GET /v1/dashboard/doctor
   * Access: CLINIC_DOCTOR, CLINIC_MANAGER
   *
   * Returns doctor-focused view: current patient, waiting queue, daily stats
   */
  @Get('doctor')
  @ClinicRoles('CLINIC_DOCTOR', 'CLINIC_MANAGER')
  async getDoctorDashboard(
    @ClinicId() clinicId: string,
    @CurrentUser() user: { id: string },
    @Query('date') date: string,
    @Query('doctorId') doctorId?: string,
  ) {
    // Default to today if no date provided
    const queryDate = date || new Date().toISOString().split('T')[0];
    return this.dashboardService.getDoctorDashboard(clinicId, user.id, queryDate, doctorId);
  }

  /**
   * GET /v1/dashboard/manager
   * Access: CLINIC_MANAGER only
   *
   * Returns analytics and KPIs for a date range
   */
  @Get('manager')
  @ClinicRoles('CLINIC_MANAGER')
  async getManagerDashboard(
    @ClinicId() clinicId: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('doctorId') doctorId?: string,
  ) {
    // Default to last 7 days if no dates provided
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const fromDate = from || weekAgo.toISOString().split('T')[0];
    const toDate = to || today.toISOString().split('T')[0];

    return this.dashboardService.getManagerDashboard(clinicId, fromDate, toDate, doctorId);
  }
}
