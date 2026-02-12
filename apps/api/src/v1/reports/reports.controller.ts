import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReportsService, UserContext } from './reports.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ClinicGuard } from '../../common/guards/clinic.guard';
import { ClinicId, ClinicRoles, ClinicRole, ClinicUserId, DoctorId } from '../../common/decorators/clinic.decorator';

@Controller('v1/reports')
@UseGuards(JwtAuthGuard, ClinicGuard)
@ClinicRoles('CLINIC_MANAGER', 'CLINIC_DOCTOR', 'CLINIC_STAFF') // All clinic roles can access reports
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  // Helper to build user context for RBAC filtering
  private buildUserContext(
    clinicRole: string,
    clinicUserId: string | null,
    doctorId: string | null,
  ): UserContext {
    return { clinicRole, clinicUserId, doctorId };
  }

  /**
   * GET /v1/reports/overview
   * Returns comprehensive overview report with KPIs, by-day, and by-doctor breakdowns.
   * - Staff: only sees data for assigned doctors
   * - Doctor: only sees their own data
   * - Manager/Admin: sees all clinic data
   */
  @Get('overview')
  async getOverview(
    @ClinicId() clinicId: string,
    @ClinicRole() clinicRole: string,
    @ClinicUserId() clinicUserId: string | null,
    @DoctorId() userDoctorId: string | null,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('doctorId') doctorId?: string,
  ) {
    const userContext = this.buildUserContext(clinicRole, clinicUserId, userDoctorId);
    return this.reportsService.getOverview(clinicId, from, to, userContext, doctorId);
  }

  /**
   * GET /v1/reports/no-shows
   * Returns no-show analysis by day-of-week and hour-of-day.
   */
  @Get('no-shows')
  async getNoShows(
    @ClinicId() clinicId: string,
    @ClinicRole() clinicRole: string,
    @ClinicUserId() clinicUserId: string | null,
    @DoctorId() userDoctorId: string | null,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('doctorId') doctorId?: string,
  ) {
    const userContext = this.buildUserContext(clinicRole, clinicUserId, userDoctorId);
    return this.reportsService.getNoShows(clinicId, from, to, userContext, doctorId);
  }

  /**
   * GET /v1/reports/wait-times
   * Returns wait time analysis with distribution buckets and daily breakdown.
   */
  @Get('wait-times')
  async getWaitTimes(
    @ClinicId() clinicId: string,
    @ClinicRole() clinicRole: string,
    @ClinicUserId() clinicUserId: string | null,
    @DoctorId() userDoctorId: string | null,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('doctorId') doctorId?: string,
  ) {
    const userContext = this.buildUserContext(clinicRole, clinicUserId, userDoctorId);
    return this.reportsService.getWaitTimes(clinicId, from, to, userContext, doctorId);
  }

  /**
   * GET /v1/reports/patients
   * Returns patient list with filters (dates, status).
   */
  @Get('patients')
  async getPatients(
    @ClinicId() clinicId: string,
    @ClinicRole() clinicRole: string,
    @ClinicUserId() clinicUserId: string | null,
    @DoctorId() userDoctorId: string | null,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const userContext = this.buildUserContext(clinicRole, clinicUserId, userDoctorId);
    return this.reportsService.getPatients(
      clinicId,
      userContext,
      from,
      to,
      status,
      limit ? parseInt(limit, 10) : undefined,
      offset ? parseInt(offset, 10) : undefined,
    );
  }

  /**
   * GET /v1/reports/queue
   * Returns daily queue report with filters (dates, doctor).
   */
  @Get('queue')
  async getQueueReport(
    @ClinicId() clinicId: string,
    @ClinicRole() clinicRole: string,
    @ClinicUserId() clinicUserId: string | null,
    @DoctorId() userDoctorId: string | null,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('doctorId') doctorId?: string,
    @Query('status') status?: string,
  ) {
    const userContext = this.buildUserContext(clinicRole, clinicUserId, userDoctorId);
    return this.reportsService.getQueueReport(clinicId, from, to, userContext, doctorId, status);
  }

  /**
   * GET /v1/reports/appointments
   * Returns appointments report with filters (dates, doctor, status).
   */
  @Get('appointments')
  async getAppointments(
    @ClinicId() clinicId: string,
    @ClinicRole() clinicRole: string,
    @ClinicUserId() clinicUserId: string | null,
    @DoctorId() userDoctorId: string | null,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('doctorId') doctorId?: string,
    @Query('status') status?: string,
  ) {
    const userContext = this.buildUserContext(clinicRole, clinicUserId, userDoctorId);
    return this.reportsService.getAppointments(clinicId, from, to, userContext, doctorId, status);
  }

  /**
   * GET /v1/reports/doctor-checkins
   * Returns doctor check-in/check-out report.
   */
  @Get('doctor-checkins')
  async getDoctorCheckins(
    @ClinicId() clinicId: string,
    @ClinicRole() clinicRole: string,
    @ClinicUserId() clinicUserId: string | null,
    @DoctorId() userDoctorId: string | null,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('doctorId') doctorId?: string,
  ) {
    const userContext = this.buildUserContext(clinicRole, clinicUserId, userDoctorId);
    return this.reportsService.getDoctorCheckins(clinicId, from, to, userContext, doctorId);
  }
}
