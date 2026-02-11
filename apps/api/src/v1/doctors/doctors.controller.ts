import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Request,
} from '@nestjs/common';
import { DoctorsService, UpdateScheduleDto, CreateTimeOffDto, ScheduleConflictCheckResult } from './doctors.service';
import { PersistentSlotsService, ScheduleImpactResult } from './persistent-slots.service';
import { SlotsService } from './slots.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ClinicGuard } from '../../common/guards/clinic.guard';
import { ClinicId, ClinicRoles } from '../../common/decorators/clinic.decorator';
import { ShiftType } from '@prisma/client';

@Controller('v1/doctors')
@UseGuards(JwtAuthGuard, ClinicGuard)
export class DoctorsController {
  constructor(
    private doctorsService: DoctorsService,
    private slotsService: SlotsService,
    private persistentSlotsService: PersistentSlotsService,
  ) {}

  // GET /v1/doctors - List doctors (All roles need to see doctors)
  // Use ?licensedOnly=true for appointments page (only show doctors who can accept appointments)
  @Get()
  @ClinicRoles('CLINIC_MANAGER', 'CLINIC_STAFF', 'CLINIC_DOCTOR')
  async listDoctors(
    @ClinicId() clinicId: string,
    @Query('includeInactive') includeInactive?: string,
    @Query('licensedOnly') licensedOnly?: string,
  ) {
    return this.doctorsService.listDoctors(
      clinicId,
      includeInactive === 'true',
      licensedOnly === 'true',
    );
  }

  // GET /v1/doctors/my-assigned - Get current user's assigned doctors (Staff only)
  // Managers see all licensed doctors, Staff see only their assigned doctors
  @Get('my-assigned')
  @ClinicRoles('CLINIC_MANAGER', 'CLINIC_STAFF', 'CLINIC_DOCTOR')
  async getMyAssignedDoctors(@Request() req: any) {
    return this.doctorsService.getAssignedDoctorsForUser(
      req.clinicId,
      req.clinicUserId,
      req.clinicRole,
    );
  }

  // GET /v1/doctors/:id - Get single doctor (All roles)
  @Get(':id')
  @ClinicRoles('CLINIC_MANAGER', 'CLINIC_STAFF', 'CLINIC_DOCTOR')
  async getDoctor(@ClinicId() clinicId: string, @Param('id') id: string) {
    return this.doctorsService.getDoctor(clinicId, id);
  }

  // POST /v1/doctors - Create doctor (Manager only)
  @Post()
  @ClinicRoles('CLINIC_MANAGER')
  async createDoctor(
    @ClinicId() clinicId: string,
    @Body()
    body: {
      fullName: string;
      specialization: string;
      appointmentDurationMin?: number;
      photoUrl?: string;
    },
  ) {
    return this.doctorsService.createDoctor(clinicId, body);
  }

  // PATCH /v1/doctors/:id - Update doctor (Manager only)
  @Patch(':id')
  @ClinicRoles('CLINIC_MANAGER')
  async updateDoctor(
    @ClinicId() clinicId: string,
    @Param('id') id: string,
    @Body()
    body: {
      fullName?: string;
      specialization?: string;
      appointmentDurationMin?: number;
      photoUrl?: string;
      isActive?: boolean;
    },
  ) {
    return this.doctorsService.updateDoctor(clinicId, id, body);
  }

  // DELETE /v1/doctors/:id - Soft delete doctor (Manager only)
  @Delete(':id')
  @ClinicRoles('CLINIC_MANAGER')
  async deleteDoctor(@ClinicId() clinicId: string, @Param('id') id: string) {
    return this.doctorsService.deleteDoctor(clinicId, id);
  }

  // GET /v1/doctors/:id/schedules - Get doctor schedules (All roles)
  @Get(':id/schedules')
  @ClinicRoles('CLINIC_MANAGER', 'CLINIC_STAFF', 'CLINIC_DOCTOR')
  async getSchedules(@ClinicId() clinicId: string, @Param('id') id: string) {
    return this.doctorsService.getSchedules(clinicId, id);
  }

  // PUT /v1/doctors/:id/schedules - Replace doctor schedules
  @Put(':id/schedules')
  async replaceSchedules(
    @ClinicId() clinicId: string,
    @Param('id') id: string,
    @Body()
    body: {
      schedules: Array<{
        dayOfWeek: number;
        startTime: string;
        endTime: string;
        isEnabled?: boolean;
      }>;
    },
  ) {
    return this.doctorsService.replaceSchedules(clinicId, id, body.schedules || []);
  }

  // ============================================
  // Doctor Schedule + Time Off Endpoints
  // ============================================

  // GET /v1/doctors/:id/schedule - Get complete schedule (templates, weekly, time off)
  // All roles can view schedules
  @Get(':id/schedule')
  @ClinicRoles('CLINIC_MANAGER', 'CLINIC_STAFF', 'CLINIC_DOCTOR')
  async getDoctorSchedule(@ClinicId() clinicId: string, @Param('id') id: string) {
    return this.doctorsService.getDoctorSchedule(clinicId, id);
  }

  // PUT /v1/doctors/:id/schedule - Update schedule (manager only)
  @Put(':id/schedule')
  @ClinicRoles('CLINIC_MANAGER')
  async updateDoctorSchedule(
    @ClinicId() clinicId: string,
    @Param('id') id: string,
    @Body() body: UpdateScheduleDto,
  ) {
    return this.doctorsService.updateDoctorSchedule(clinicId, id, body);
  }

  // POST /v1/doctors/:id/schedule/check-conflicts - Check for appointment conflicts before updating schedule
  @Post(':id/schedule/check-conflicts')
  @ClinicRoles('CLINIC_MANAGER')
  async checkScheduleConflicts(
    @ClinicId() clinicId: string,
    @Param('id') id: string,
    @Body() body: UpdateScheduleDto & { startDate?: string; endDate?: string },
  ): Promise<ScheduleConflictCheckResult> {
    const { startDate, endDate, ...proposedChanges } = body;
    return this.doctorsService.checkScheduleConflicts(clinicId, id, proposedChanges, startDate, endDate);
  }

  // PUT /v1/doctors/:id/schedule/with-conflicts - Update schedule and cancel conflicting appointments
  @Put(':id/schedule/with-conflicts')
  @ClinicRoles('CLINIC_MANAGER')
  async updateScheduleWithConflictResolution(
    @ClinicId() clinicId: string,
    @Param('id') id: string,
    @Body() body: UpdateScheduleDto & {
      cancelConflictingAppointments?: boolean;
      appointmentIdsToCancel?: string[];
    },
  ) {
    const { cancelConflictingAppointments, appointmentIdsToCancel, ...scheduleData } = body;
    return this.doctorsService.updateScheduleWithConflictResolution(
      clinicId,
      id,
      scheduleData,
      cancelConflictingAppointments || false,
      appointmentIdsToCancel,
    );
  }

  // POST /v1/doctors/:id/timeoff - Create time off (manager only)
  @Post(':id/timeoff')
  @ClinicRoles('CLINIC_MANAGER')
  async createTimeOff(
    @ClinicId() clinicId: string,
    @Param('id') id: string,
    @Body() body: CreateTimeOffDto,
  ) {
    return this.doctorsService.createTimeOff(clinicId, id, body);
  }

  // DELETE /v1/doctors/:id/timeoff/:timeoffId - Delete time off (manager only)
  @Delete(':id/timeoff/:timeoffId')
  @ClinicRoles('CLINIC_MANAGER')
  async deleteTimeOff(
    @ClinicId() clinicId: string,
    @Param('id') id: string,
    @Param('timeoffId') timeoffId: string,
  ) {
    return this.doctorsService.deleteTimeOff(clinicId, id, timeoffId);
  }

  // POST /v1/doctors/:id/schedule/preview-impact - Preview appointments affected by schedule changes
  @Post(':id/schedule/preview-impact')
  @ClinicRoles('CLINIC_MANAGER')
  async previewScheduleImpact(
    @ClinicId() clinicId: string,
    @Param('id') id: string,
    @Body() body: UpdateScheduleDto,
  ): Promise<ScheduleImpactResult> {
    return this.persistentSlotsService.getImpactedAppointments(clinicId, id, {
      appointmentDurationMin: body.appointmentDurationMin,
      shiftTemplate: body.shiftTemplate as Record<ShiftType, { start: string; end: string }> | undefined,
      weekly: body.weekly?.map(w => ({
        dayOfWeek: w.dayOfWeek,
        shifts: w.shifts as Record<ShiftType, boolean>,
      })),
    });
  }

  // ============================================
  // Persisted Slot Endpoints
  // ============================================

  // GET /v1/doctors/:id/slots - Get persisted slots for a specific date (All roles)
  // Returns in the same format as the old generateSlots for backwards compatibility
  @Get(':id/slots')
  @ClinicRoles('CLINIC_MANAGER', 'CLINIC_STAFF', 'CLINIC_DOCTOR')
  async getSlots(
    @ClinicId() clinicId: string,
    @Param('id') id: string,
    @Query('date') date: string,
    @Query('status') status?: 'AVAILABLE' | 'all',
  ) {
    // Get clinic timezone and doctor duration for response
    const [clinic, doctor] = await Promise.all([
      this.doctorsService.getClinicTimezone(clinicId),
      this.doctorsService.getDoctor(clinicId, id),
    ]);

    const slots = status === 'all'
      ? await this.persistentSlotsService.getSlotsForDate(clinicId, id, date)
      : await this.persistentSlotsService.getAvailableSlots(clinicId, id, date);

    // Transform to frontend-expected format
    // Use clinic timezone for time display
    const timezone = clinic || 'UTC';
    const transformedSlots = slots.map(slot => {
      const startsAt = new Date(slot.startsAt);
      // Format time in clinic timezone (not server local time)
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      const parts = formatter.formatToParts(startsAt);
      const hours = parts.find(p => p.type === 'hour')?.value || '00';
      const minutes = parts.find(p => p.type === 'minute')?.value || '00';

      const transformed: any = {
        id: slot.id,
        time: `${hours}:${minutes}`,
        startsAt: slot.startsAt.toISOString(),
        endsAt: slot.endsAt.toISOString(),
        shift: slot.shiftType,
        isAvailable: slot.status === 'AVAILABLE',
      };

      // Include appointment details if booked
      if ('appointment' in slot && slot.appointment) {
        const appt = slot.appointment as {
          id: string;
          reason?: string | null;
          status: string;
          patient: { id: string; fullName: string; phone?: string | null };
        };
        transformed.appointment = {
          id: appt.id,
          reason: appt.reason,
          status: appt.status,
          patient: appt.patient,
        };
      }

      return transformed;
    });

    return {
      slots: transformedSlots,
      timezone: clinic,
      doctorDurationMin: doctor.appointmentDurationMin,
    };
  }

  // GET /v1/doctors/:id/slots/range - Get persisted slots for a date range (All roles)
  @Get(':id/slots/range')
  @ClinicRoles('CLINIC_MANAGER', 'CLINIC_STAFF', 'CLINIC_DOCTOR')
  async getSlotsForRange(
    @ClinicId() clinicId: string,
    @Param('id') id: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.persistentSlotsService.getSlotsForRange(clinicId, id, startDate, endDate);
  }

  // GET /v1/doctors/:id/slots/stats - Get slot statistics for a date range (Manager only)
  @Get(':id/slots/stats')
  @ClinicRoles('CLINIC_MANAGER')
  async getSlotStats(
    @ClinicId() clinicId: string,
    @Param('id') id: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.persistentSlotsService.getSlotStats(clinicId, id, startDate, endDate);
  }

  // ============================================
  // Legacy Slot Generation Endpoints (deprecated, kept for backwards compatibility)
  // ============================================

  // GET /v1/doctors/:id/slots/generate - Generate slots on-the-fly (deprecated)
  @Get(':id/slots/generate')
  @ClinicRoles('CLINIC_MANAGER', 'CLINIC_STAFF', 'CLINIC_DOCTOR')
  async generateSlots(
    @ClinicId() clinicId: string,
    @Param('id') id: string,
    @Query('date') date: string,
  ) {
    return this.slotsService.generateSlots(clinicId, id, date);
  }

  // GET /v1/doctors/:id/slots/summary - Get slots summary for a date range (Manager only)
  @Get(':id/slots/summary')
  @ClinicRoles('CLINIC_MANAGER')
  async getSlotsSummary(
    @ClinicId() clinicId: string,
    @Param('id') id: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.slotsService.getSlotsSummary(clinicId, id, startDate, endDate);
  }
}
