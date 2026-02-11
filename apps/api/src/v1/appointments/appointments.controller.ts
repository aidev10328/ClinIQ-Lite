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
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto, ListAppointmentsQueryDto } from './appointments.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ClinicGuard } from '../../common/guards/clinic.guard';
import { ClinicId, ClinicRoles, CurrentUser } from '../../common/decorators/clinic.decorator';

@Controller('v1/appointments')
@UseGuards(JwtAuthGuard, ClinicGuard)
@ClinicRoles('CLINIC_MANAGER', 'CLINIC_STAFF', 'CLINIC_DOCTOR')
export class AppointmentsController {
  constructor(private appointmentsService: AppointmentsService) {}

  // GET /v1/appointments - List appointments
  @Get()
  async listAppointments(
    @ClinicId() clinicId: string,
    @Query() query: ListAppointmentsQueryDto,
  ) {
    return this.appointmentsService.listAppointments(clinicId, query);
  }

  // GET /v1/appointments/:id - Get single appointment
  @Get(':id')
  async getAppointment(@ClinicId() clinicId: string, @Param('id') id: string) {
    return this.appointmentsService.getAppointment(clinicId, id);
  }

  // POST /v1/appointments - Create appointment
  @Post()
  async createAppointment(
    @ClinicId() clinicId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateAppointmentDto,
  ) {
    return this.appointmentsService.createAppointment(clinicId, dto, user.id);
  }

  // PATCH /v1/appointments/:id/cancel - Cancel appointment
  @Patch(':id/cancel')
  async cancelAppointment(@ClinicId() clinicId: string, @Param('id') id: string) {
    return this.appointmentsService.cancelAppointment(clinicId, id);
  }

  // POST /v1/appointments/:id/checkin - Check in appointment
  @Post(':id/checkin')
  async checkinAppointment(@ClinicId() clinicId: string, @Param('id') id: string) {
    return this.appointmentsService.checkinAppointment(clinicId, id);
  }

  // PATCH /v1/appointments/:id/no-show - Mark appointment as no-show
  @Patch(':id/no-show')
  async markNoShow(@ClinicId() clinicId: string, @Param('id') id: string) {
    return this.appointmentsService.markNoShow(clinicId, id);
  }

  // PATCH /v1/appointments/:id/reschedule - Reschedule appointment (marks as RESCHEDULED, releases slot)
  @Patch(':id/reschedule')
  async rescheduleAppointment(@ClinicId() clinicId: string, @Param('id') id: string) {
    return this.appointmentsService.rescheduleAppointment(clinicId, id);
  }
}
