import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ClinicGuard } from '../../common/guards/clinic.guard';
import { ClinicId, ClinicRoles } from '../../common/decorators/clinic.decorator';

@Controller('v1/reports')
@UseGuards(JwtAuthGuard, ClinicGuard)
@ClinicRoles('CLINIC_MANAGER', 'CLINIC_DOCTOR') // Power users only
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  /**
   * GET /v1/reports/overview
   * Returns comprehensive overview report with KPIs, by-day, and by-doctor breakdowns.
   *
   * Example:
   * curl -H "Authorization: Bearer $TOKEN" -H "x-clinic-id: $CLINIC_ID" \
   *   "http://localhost:4000/v1/reports/overview?from=2024-01-01&to=2024-01-31"
   */
  @Get('overview')
  async getOverview(
    @ClinicId() clinicId: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('doctorId') doctorId?: string,
  ) {
    return this.reportsService.getOverview(clinicId, from, to, doctorId);
  }

  /**
   * GET /v1/reports/no-shows
   * Returns no-show analysis by day-of-week and hour-of-day.
   *
   * Example:
   * curl -H "Authorization: Bearer $TOKEN" -H "x-clinic-id: $CLINIC_ID" \
   *   "http://localhost:4000/v1/reports/no-shows?from=2024-01-01&to=2024-01-31"
   */
  @Get('no-shows')
  async getNoShows(
    @ClinicId() clinicId: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('doctorId') doctorId?: string,
  ) {
    return this.reportsService.getNoShows(clinicId, from, to, doctorId);
  }

  /**
   * GET /v1/reports/wait-times
   * Returns wait time analysis with distribution buckets and daily breakdown.
   *
   * Example:
   * curl -H "Authorization: Bearer $TOKEN" -H "x-clinic-id: $CLINIC_ID" \
   *   "http://localhost:4000/v1/reports/wait-times?from=2024-01-01&to=2024-01-31"
   */
  @Get('wait-times')
  async getWaitTimes(
    @ClinicId() clinicId: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('doctorId') doctorId?: string,
  ) {
    return this.reportsService.getWaitTimes(clinicId, from, to, doctorId);
  }
}
