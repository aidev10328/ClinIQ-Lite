import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { TimezoneService } from '../../common/timezone.service';
import { ShiftType, TimeOffType } from '@prisma/client';
import { PersistentSlotsService, ImpactedAppointment, SlotGenerationResult } from './persistent-slots.service';

// Type definitions for schedule DTOs
export interface ShiftTemplateDto {
  start: string;
  end: string;
}

export interface WeeklyShiftDto {
  dayOfWeek: number;
  shifts: {
    MORNING: boolean;
    AFTERNOON: boolean;
  };
}

export interface TimeOffDto {
  id: string;
  startDate: string;
  endDate: string;
  type: TimeOffType;
  reason: string | null;
}

export interface DoctorScheduleResponse {
  doctor: {
    id: string;
    fullName: string;
    specialization: string;
    appointmentDurationMin: number;
  };
  shiftTemplate: {
    MORNING: ShiftTemplateDto | null;
    AFTERNOON: ShiftTemplateDto | null;
  };
  weekly: WeeklyShiftDto[];
  timeOff: TimeOffDto[];
}

export interface UpdateScheduleDto {
  appointmentDurationMin?: number;
  shiftTemplate?: {
    MORNING?: { start: string; end: string };
    AFTERNOON?: { start: string; end: string };
  };
  weekly?: Array<{
    dayOfWeek: number;
    shifts: {
      MORNING?: boolean;
      AFTERNOON?: boolean;
    };
  }>;
}

export interface CreateTimeOffDto {
  startDate: string;
  endDate: string;
  type: TimeOffType;
  reason?: string;
  forceDelete?: boolean; // If true, cancel booked appointments
}

export interface TimeOffCreateResult {
  timeOff: TimeOffDto;
  slotsDeleted: number;
  bookedAppointments: ImpactedAppointment[];
  appointmentsCancelled: number;
}

export interface TimeOffDeleteResult {
  slotsRestored: number;
}

export interface ScheduleUpdateResult {
  schedule: DoctorScheduleResponse;
  slotsGenerated?: SlotGenerationResult;
  isFirstTimeConfiguration?: boolean;
}

export interface ConflictingAppointment {
  id: string;
  startsAt: Date;
  endsAt: Date;
  patientName: string;
  patientPhone: string;
  reason: string; // Why it conflicts: 'DURATION_MISMATCH' | 'SHIFT_DISABLED' | 'TIME_OUTSIDE_SHIFT'
}

export interface ScheduleConflictCheckResult {
  hasConflicts: boolean;
  conflictingAppointments: ConflictingAppointment[];
  totalConflicts: number;
}

@Injectable()
export class DoctorsService {
  constructor(
    private prisma: PrismaService,
    private timezoneService: TimezoneService,
    private persistentSlotsService: PersistentSlotsService,
  ) {}

  // List doctors for clinic
  // licensedOnly: if true, only return doctors with licenses (for appointments page)
  async listDoctors(clinicId: string, includeInactive = false, licensedOnly = false) {
    return this.prisma.doctor.findMany({
      where: {
        clinicId,
        ...(includeInactive ? {} : { isActive: true }),
        ...(licensedOnly ? { hasLicense: true } : {}),
      },
      orderBy: { fullName: 'asc' },
      select: {
        id: true,
        fullName: true,
        specialization: true,
        appointmentDurationMin: true,
        photoUrl: true,
        hasLicense: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { schedules: true },
        },
      },
    });
  }

  // Get assigned doctors for a user based on their role
  // Managers and Doctors see all licensed doctors
  // Staff see only their assigned doctors
  async getAssignedDoctorsForUser(clinicId: string, clinicUserId: string, role: string) {
    // Managers and Doctors see all licensed doctors
    if (role === 'CLINIC_MANAGER' || role === 'CLINIC_DOCTOR') {
      return this.prisma.doctor.findMany({
        where: { clinicId, hasLicense: true, isActive: true },
        orderBy: { fullName: 'asc' },
        select: {
          id: true,
          fullName: true,
          specialization: true,
          appointmentDurationMin: true,
          photoUrl: true,
          hasLicense: true,
        },
      });
    }

    // Staff see only their assigned doctors
    const assignments = await this.prisma.staffDoctorAssignment.findMany({
      where: { clinicId, clinicUserId },
      include: {
        doctor: {
          select: {
            id: true,
            fullName: true,
            specialization: true,
            appointmentDurationMin: true,
            photoUrl: true,
            hasLicense: true,
            isActive: true,
          },
        },
      },
    });

    // Filter to only active licensed doctors
    return assignments
      .map((a) => a.doctor)
      .filter((d) => d.isActive && d.hasLicense);
  }

  // Get clinic timezone
  async getClinicTimezone(clinicId: string): Promise<string> {
    const clinic = await this.prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { timezone: true },
    });
    return clinic?.timezone || 'America/Chicago';
  }

  // Get single doctor
  async getDoctor(clinicId: string, doctorId: string) {
    const doctor = await this.prisma.doctor.findFirst({
      where: { id: doctorId, clinicId },
      include: {
        schedules: {
          orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
        },
      },
    });

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    return doctor;
  }

  // Create doctor
  async createDoctor(
    clinicId: string,
    data: {
      fullName: string;
      specialization: string;
      appointmentDurationMin?: number;
      photoUrl?: string;
    },
  ) {
    return this.prisma.doctor.create({
      data: {
        clinicId,
        fullName: data.fullName,
        specialization: data.specialization,
        appointmentDurationMin: data.appointmentDurationMin || 15,
        photoUrl: data.photoUrl,
      },
    });
  }

  // Update doctor
  async updateDoctor(
    clinicId: string,
    doctorId: string,
    data: {
      fullName?: string;
      specialization?: string;
      appointmentDurationMin?: number;
      photoUrl?: string;
      isActive?: boolean;
    },
  ) {
    const doctor = await this.prisma.doctor.findFirst({
      where: { id: doctorId, clinicId },
    });

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    return this.prisma.doctor.update({
      where: { id: doctorId },
      data,
    });
  }

  // Soft delete doctor
  async deleteDoctor(clinicId: string, doctorId: string) {
    const doctor = await this.prisma.doctor.findFirst({
      where: { id: doctorId, clinicId },
    });

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    return this.prisma.doctor.update({
      where: { id: doctorId },
      data: { isActive: false },
    });
  }

  // Get doctor schedules
  async getSchedules(clinicId: string, doctorId: string) {
    const doctor = await this.prisma.doctor.findFirst({
      where: { id: doctorId, clinicId },
    });

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    return this.prisma.doctorSchedule.findMany({
      where: { doctorId },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  }

  // Replace schedules for doctor
  async replaceSchedules(
    clinicId: string,
    doctorId: string,
    schedules: Array<{
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      isEnabled?: boolean;
    }>,
  ) {
    const doctor = await this.prisma.doctor.findFirst({
      where: { id: doctorId, clinicId },
    });

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    // Validate schedules
    for (const schedule of schedules) {
      if (schedule.dayOfWeek < 0 || schedule.dayOfWeek > 6) {
        throw new BadRequestException('dayOfWeek must be between 0 and 6');
      }
      if (schedule.startTime >= schedule.endTime) {
        throw new BadRequestException('startTime must be before endTime');
      }
      // Validate time format (HH:MM)
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
      if (!timeRegex.test(schedule.startTime) || !timeRegex.test(schedule.endTime)) {
        throw new BadRequestException('Time must be in HH:MM format');
      }
    }

    // Delete existing and create new in a transaction
    return this.prisma.$transaction(async (tx) => {
      await tx.doctorSchedule.deleteMany({
        where: { doctorId },
      });

      if (schedules.length > 0) {
        await tx.doctorSchedule.createMany({
          data: schedules.map((s) => ({
            clinicId,
            doctorId,
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime,
            endTime: s.endTime,
            isEnabled: s.isEnabled ?? true,
          })),
        });
      }

      return tx.doctorSchedule.findMany({
        where: { doctorId },
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
      });
    });
  }

  // ============================================
  // Doctor Schedule + Time Off Methods
  // ============================================

  // Get complete doctor schedule including shift templates, weekly shifts, and time off
  async getDoctorSchedule(clinicId: string, doctorId: string): Promise<DoctorScheduleResponse> {
    const doctor = await this.prisma.doctor.findFirst({
      where: { id: doctorId, clinicId },
      select: {
        id: true,
        fullName: true,
        specialization: true,
        appointmentDurationMin: true,
      },
    });

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    // Get shift templates
    const shiftTemplates = await this.prisma.doctorShiftTemplate.findMany({
      where: { doctorId },
    });

    // Build shift template map
    const shiftTemplateMap: DoctorScheduleResponse['shiftTemplate'] = {
      MORNING: null,
      AFTERNOON: null,
    };

    for (const template of shiftTemplates) {
      shiftTemplateMap[template.shiftType] = {
        start: template.startTime,
        end: template.endTime,
      };
    }

    // Get weekly shifts
    const weeklyShifts = await this.prisma.doctorWeeklyShift.findMany({
      where: { doctorId },
      orderBy: { dayOfWeek: 'asc' },
    });

    // Build weekly schedule (0-6 for each day)
    const weeklyMap: Record<number, { MORNING: boolean; AFTERNOON: boolean }> = {};
    for (let day = 0; day <= 6; day++) {
      weeklyMap[day] = { MORNING: false, AFTERNOON: false };
    }

    for (const shift of weeklyShifts) {
      if (weeklyMap[shift.dayOfWeek]) {
        weeklyMap[shift.dayOfWeek][shift.shiftType] = shift.isEnabled;
      }
    }

    const weekly: WeeklyShiftDto[] = Object.entries(weeklyMap).map(([day, shifts]) => ({
      dayOfWeek: parseInt(day),
      shifts,
    }));

    // Get time off entries (future and recent)
    const timeOffEntries = await this.prisma.doctorTimeOff.findMany({
      where: { doctorId },
      orderBy: { startDate: 'asc' },
    });

    // Get clinic timezone for formatting dates
    const timezone = await this.getClinicTimezone(clinicId);

    const timeOff: TimeOffDto[] = timeOffEntries.map((entry) => ({
      id: entry.id,
      startDate: this.timezoneService.formatDateInTimezone(entry.startDate, timezone),
      endDate: this.timezoneService.formatDateInTimezone(entry.endDate, timezone),
      type: entry.type,
      reason: entry.reason,
    }));

    return {
      doctor,
      shiftTemplate: shiftTemplateMap,
      weekly,
      timeOff,
    };
  }

  // Update doctor schedule (shift templates and weekly shifts)
  async updateDoctorSchedule(
    clinicId: string,
    doctorId: string,
    data: UpdateScheduleDto,
  ): Promise<ScheduleUpdateResult> {
    const doctor = await this.prisma.doctor.findFirst({
      where: { id: doctorId, clinicId },
    });

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    // Check if schedule was previously configured (for first-time detection)
    const wasConfiguredBefore = doctor.scheduleConfiguredAt !== null;

    // Validate time format
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

    if (data.shiftTemplate) {
      for (const [shiftType, times] of Object.entries(data.shiftTemplate)) {
        if (times) {
          if (!timeRegex.test(times.start)) {
            throw new BadRequestException(`Invalid start time for ${shiftType}: ${times.start}`);
          }
          if (!timeRegex.test(times.end)) {
            throw new BadRequestException(`Invalid end time for ${shiftType}: ${times.end}`);
          }
        }
      }
    }

    if (data.weekly) {
      for (const entry of data.weekly) {
        if (entry.dayOfWeek < 0 || entry.dayOfWeek > 6) {
          throw new BadRequestException('dayOfWeek must be between 0 and 6');
        }
      }
    }

    // Perform updates in a transaction
    await this.prisma.$transaction(async (tx) => {
      // Update appointmentDurationMin if provided
      if (data.appointmentDurationMin !== undefined) {
        await tx.doctor.update({
          where: { id: doctorId },
          data: { appointmentDurationMin: data.appointmentDurationMin },
        });
      }

      // Update shift templates
      if (data.shiftTemplate) {
        const shiftTypes: ShiftType[] = ['MORNING', 'AFTERNOON'];

        for (const shiftType of shiftTypes) {
          const template = data.shiftTemplate[shiftType];

          if (template) {
            await tx.doctorShiftTemplate.upsert({
              where: {
                doctorId_shiftType: { doctorId, shiftType },
              },
              update: {
                startTime: template.start,
                endTime: template.end,
              },
              create: {
                clinicId,
                doctorId,
                shiftType,
                startTime: template.start,
                endTime: template.end,
              },
            });
          }
        }
      }

      // Update weekly shifts
      if (data.weekly) {
        for (const weekEntry of data.weekly) {
          const shiftTypes: ShiftType[] = ['MORNING', 'AFTERNOON'];

          for (const shiftType of shiftTypes) {
            const isEnabled = weekEntry.shifts[shiftType];

            if (isEnabled !== undefined) {
              await tx.doctorWeeklyShift.upsert({
                where: {
                  doctorId_dayOfWeek_shiftType: {
                    doctorId,
                    dayOfWeek: weekEntry.dayOfWeek,
                    shiftType,
                  },
                },
                update: { isEnabled },
                create: {
                  clinicId,
                  doctorId,
                  dayOfWeek: weekEntry.dayOfWeek,
                  shiftType,
                  isEnabled,
                },
              });
            }
          }
        }
      }
    });

    // Get updated schedule
    const schedule = await this.getDoctorSchedule(clinicId, doctorId);

    // Check if this is the first time schedule is fully configured
    if (!wasConfiguredBefore) {
      const isFullyConfigured = await this.persistentSlotsService.isScheduleFullyConfigured(doctorId);

      if (isFullyConfigured) {
        // Mark schedule as configured, but DON'T auto-generate slots
        // Admin must manually generate slots via the admin UI
        await this.prisma.doctor.update({
          where: { id: doctorId },
          data: { scheduleConfiguredAt: new Date() },
        });

        return {
          schedule,
          isFirstTimeConfiguration: true,
          // No slotsGenerated - admin must generate manually
        };
      }
    } else {
      // Schedule was already configured - regenerate slots within stored range
      // This only regenerates from today to the previously stored end date
      // If no slots were ever generated, this is a no-op
      const regenResult = await this.persistentSlotsService.regenerateSlotsAfterScheduleChange(
        clinicId,
        doctorId,
        false, // Don't auto-cancel impacted appointments
      );

      if (!regenResult.skipped) {
        return {
          schedule,
          slotsRegenerated: {
            deleted: regenResult.deletedAvailable,
            created: regenResult.created,
          },
        };
      }
      // If skipped (no slots generated yet), just return the schedule
    }

    return { schedule };
  }

  // Create time off entry
  // Dates are interpreted in clinic timezone
  async createTimeOff(
    clinicId: string,
    doctorId: string,
    data: CreateTimeOffDto,
  ): Promise<TimeOffCreateResult> {
    const doctor = await this.prisma.doctor.findFirst({
      where: { id: doctorId, clinicId },
    });

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    // Get clinic timezone
    const timezone = await this.getClinicTimezone(clinicId);

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(data.startDate)) {
      throw new BadRequestException('Invalid startDate format. Use YYYY-MM-DD');
    }
    if (!dateRegex.test(data.endDate)) {
      throw new BadRequestException('Invalid endDate format. Use YYYY-MM-DD');
    }

    // For @db.Date fields, use UTC midnight for consistent storage and querying
    const startDate = this.timezoneService.toUtcMidnight(data.startDate);
    const endDate = this.timezoneService.toUtcMidnight(data.endDate);

    if (startDate > endDate) {
      throw new BadRequestException('startDate must be before or equal to endDate');
    }

    // Validate type
    const validTypes: TimeOffType[] = ['BREAK', 'VACATION', 'OTHER'];
    if (!validTypes.includes(data.type)) {
      throw new BadRequestException(`type must be one of: ${validTypes.join(', ')}`);
    }

    // First, check if there are booked slots in this date range
    const slotDeletionResult = await this.persistentSlotsService.deleteSlotsForDateRange(
      clinicId,
      doctorId,
      startDate,
      endDate,
    );

    let appointmentsCancelled = 0;

    // If there are booked appointments and forceDelete is not set, throw with warning
    if (slotDeletionResult.bookedAppointments.length > 0 && !data.forceDelete) {
      throw new BadRequestException({
        message: 'Cannot create time-off: There are booked appointments in this date range',
        bookedAppointments: slotDeletionResult.bookedAppointments,
        totalBooked: slotDeletionResult.bookedAppointments.length,
        code: 'BOOKED_SLOTS_EXIST',
      });
    }

    // If forceDelete is set, cancel the booked appointments and delete all slots
    if (slotDeletionResult.bookedAppointments.length > 0 && data.forceDelete) {
      const forceResult = await this.persistentSlotsService.forceDeleteSlotsForDateRange(
        clinicId,
        doctorId,
        startDate,
        endDate,
      );
      appointmentsCancelled = forceResult.cancelledAppointments;
    }

    // Create the time-off entry
    const timeOff = await this.prisma.doctorTimeOff.create({
      data: {
        clinicId,
        doctorId,
        startDate,
        endDate,
        type: data.type,
        reason: data.reason,
      },
    });

    return {
      timeOff: {
        id: timeOff.id,
        startDate: this.timezoneService.formatDateInTimezone(timeOff.startDate, timezone),
        endDate: this.timezoneService.formatDateInTimezone(timeOff.endDate, timezone),
        type: timeOff.type,
        reason: timeOff.reason,
      },
      slotsDeleted: slotDeletionResult.deletedCount,
      bookedAppointments: slotDeletionResult.bookedAppointments,
      appointmentsCancelled,
    };
  }

  // Delete time off entry
  async deleteTimeOff(clinicId: string, doctorId: string, timeOffId: string): Promise<TimeOffDeleteResult> {
    const doctor = await this.prisma.doctor.findFirst({
      where: { id: doctorId, clinicId },
    });

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    const timeOff = await this.prisma.doctorTimeOff.findFirst({
      where: { id: timeOffId, doctorId, clinicId },
    });

    if (!timeOff) {
      throw new NotFoundException('Time off entry not found');
    }

    // Delete the time-off entry
    await this.prisma.doctorTimeOff.delete({
      where: { id: timeOffId },
    });

    // Restore slots for the date range (only if schedule is configured)
    if (doctor.scheduleConfiguredAt) {
      const restoreResult = await this.persistentSlotsService.restoreSlotsForDateRange(
        clinicId,
        doctorId,
        timeOff.startDate,
        timeOff.endDate,
      );

      return { slotsRestored: restoreResult.restored };
    }

    return { slotsRestored: 0 };
  }

  // ============================================
  // Schedule Conflict Checking Methods
  // ============================================

  /**
   * Check for conflicting appointments if schedule changes are applied
   * This checks future BOOKED appointments against proposed schedule
   */
  async checkScheduleConflicts(
    clinicId: string,
    doctorId: string,
    proposedChanges: UpdateScheduleDto,
    startDate?: string,
    endDate?: string,
  ): Promise<ScheduleConflictCheckResult> {
    const doctor = await this.prisma.doctor.findFirst({
      where: { id: doctorId, clinicId },
    });

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    // Get current schedule to merge with proposed changes
    const currentSchedule = await this.getDoctorSchedule(clinicId, doctorId);

    // Determine the new duration (proposed or current)
    const newDuration = proposedChanges.appointmentDurationMin ?? doctor.appointmentDurationMin;

    // Merge shift templates
    const newShiftTemplates: Record<string, { start: string; end: string } | null> = {
      MORNING: currentSchedule.shiftTemplate.MORNING,
      AFTERNOON: currentSchedule.shiftTemplate.AFTERNOON,
    };
    if (proposedChanges.shiftTemplate) {
      for (const [shift, times] of Object.entries(proposedChanges.shiftTemplate)) {
        if (times) {
          newShiftTemplates[shift] = times;
        }
      }
    }

    // Merge weekly shifts
    const newWeeklyShifts: Record<number, Record<string, boolean>> = {};
    for (const entry of currentSchedule.weekly) {
      newWeeklyShifts[entry.dayOfWeek] = { ...entry.shifts };
    }
    if (proposedChanges.weekly) {
      for (const entry of proposedChanges.weekly) {
        if (!newWeeklyShifts[entry.dayOfWeek]) {
          newWeeklyShifts[entry.dayOfWeek] = { MORNING: false, AFTERNOON: false };
        }
        for (const [shift, enabled] of Object.entries(entry.shifts)) {
          if (enabled !== undefined) {
            newWeeklyShifts[entry.dayOfWeek][shift] = enabled;
          }
        }
      }
    }

    // Get future BOOKED appointments (only future appointments can conflict)
    const now = new Date();
    const queryStartDate = startDate ? new Date(startDate) : now;
    // Default to 90 days in the future if no end date specified
    const queryEndDate = endDate ? new Date(endDate) : new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    const bookedAppointments = await this.prisma.appointment.findMany({
      where: {
        doctorId,
        clinicId,
        status: 'BOOKED',
        startsAt: {
          gte: queryStartDate,
          lte: queryEndDate,
        },
      },
      include: {
        patient: {
          select: { fullName: true, phone: true },
        },
      },
      orderBy: { startsAt: 'asc' },
    });

    const conflictingAppointments: ConflictingAppointment[] = [];

    for (const appt of bookedAppointments) {
      const apptStart = new Date(appt.startsAt);
      const apptEnd = new Date(appt.endsAt);
      const dayOfWeek = apptStart.getDay();
      const apptHour = apptStart.getHours();
      const apptMinute = apptStart.getMinutes();
      const apptTimeStr = `${String(apptHour).padStart(2, '0')}:${String(apptMinute).padStart(2, '0')}`;

      // Check 1: Duration mismatch - appointment start time doesn't align with new slot grid
      const apptDuration = (apptEnd.getTime() - apptStart.getTime()) / (1000 * 60);
      const currentTotalMinutes = apptHour * 60 + apptMinute;

      // Find which shift this appointment falls into
      let appointmentShift: string | null = null;
      for (const [shift, times] of Object.entries(newShiftTemplates)) {
        if (!times) continue;
        const [shiftStartH, shiftStartM] = times.start.split(':').map(Number);
        const [shiftEndH, shiftEndM] = times.end.split(':').map(Number);
        const shiftStartMinutes = shiftStartH * 60 + shiftStartM;
        const shiftEndMinutes = shiftEndH * 60 + shiftEndM;

        if (currentTotalMinutes >= shiftStartMinutes && currentTotalMinutes < shiftEndMinutes) {
          appointmentShift = shift;
          break;
        }
      }

      // Check 2: Appointment falls outside all shift ranges
      if (!appointmentShift) {
        conflictingAppointments.push({
          id: appt.id,
          startsAt: appt.startsAt,
          endsAt: appt.endsAt,
          patientName: appt.patient.fullName,
          patientPhone: appt.patient.phone,
          reason: 'TIME_OUTSIDE_SHIFT',
        });
        continue;
      }

      // Check 3: Shift is disabled for that day
      const dayShifts = newWeeklyShifts[dayOfWeek];
      if (!dayShifts || !dayShifts[appointmentShift]) {
        conflictingAppointments.push({
          id: appt.id,
          startsAt: appt.startsAt,
          endsAt: appt.endsAt,
          patientName: appt.patient.fullName,
          patientPhone: appt.patient.phone,
          reason: 'SHIFT_DISABLED',
        });
        continue;
      }

      // Check 4: Appointment doesn't align with new slot grid (duration mismatch)
      const shiftTemplate = newShiftTemplates[appointmentShift];
      if (shiftTemplate) {
        const [shiftStartH, shiftStartM] = shiftTemplate.start.split(':').map(Number);
        const shiftStartMinutes = shiftStartH * 60 + shiftStartM;
        const minutesFromShiftStart = currentTotalMinutes - shiftStartMinutes;

        // Check if this appointment time would be a valid slot start time with the new duration
        if (minutesFromShiftStart % newDuration !== 0) {
          conflictingAppointments.push({
            id: appt.id,
            startsAt: appt.startsAt,
            endsAt: appt.endsAt,
            patientName: appt.patient.fullName,
            patientPhone: appt.patient.phone,
            reason: 'DURATION_MISMATCH',
          });
          continue;
        }
      }
    }

    return {
      hasConflicts: conflictingAppointments.length > 0,
      conflictingAppointments,
      totalConflicts: conflictingAppointments.length,
    };
  }

  /**
   * Update schedule and optionally cancel conflicting appointments
   * Also regenerates slots if schedule was already configured
   */
  async updateScheduleWithConflictResolution(
    clinicId: string,
    doctorId: string,
    data: UpdateScheduleDto,
    cancelConflictingAppointments: boolean = false,
    appointmentIdsToCancel?: string[],
  ): Promise<{
    schedule: DoctorScheduleResponse;
    cancelledAppointments: string[];
    slotsRegenerated?: {
      deletedAvailable: number;
      created: number;
    };
  }> {
    const doctor = await this.prisma.doctor.findFirst({
      where: { id: doctorId, clinicId },
    });

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    // Use persistent slots to check for impacted appointments
    const impact = await this.persistentSlotsService.getImpactedAppointments(clinicId, doctorId, {
      appointmentDurationMin: data.appointmentDurationMin,
      shiftTemplate: data.shiftTemplate as Record<ShiftType, { start: string; end: string }> | undefined,
      weekly: data.weekly?.map(w => ({
        dayOfWeek: w.dayOfWeek,
        shifts: w.shifts as Record<ShiftType, boolean>,
      })),
    });

    if (impact.totalImpacted > 0 && !cancelConflictingAppointments) {
      throw new BadRequestException({
        message: 'Schedule change would conflict with existing appointments',
        conflicts: impact.impactedAppointments,
        totalConflicts: impact.totalImpacted,
      });
    }

    const cancelledAppointments: string[] = [];

    // Cancel specified appointments in a transaction
    await this.prisma.$transaction(async (tx) => {
      if (cancelConflictingAppointments && impact.impactedAppointments.length > 0) {
        // Cancel either specified appointments or all impacted ones
        const idsToCancel = appointmentIdsToCancel || impact.impactedAppointments.map(a => a.id);

        for (const apptId of idsToCancel) {
          await tx.appointment.update({
            where: { id: apptId },
            data: { status: 'CANCELLED' },
          });
          cancelledAppointments.push(apptId);

          // Release the slot
          await this.persistentSlotsService.releaseSlot(apptId);
        }
      }
    });

    // Now update the schedule
    const scheduleResult = await this.updateDoctorSchedule(clinicId, doctorId, data);

    // If schedule was already configured (not first time), regenerate slots
    if (doctor.scheduleConfiguredAt && !scheduleResult.isFirstTimeConfiguration) {
      const regenResult = await this.persistentSlotsService.regenerateSlotsAfterScheduleChange(
        clinicId,
        doctorId,
        false, // Don't cancel again, we already handled it above
      );

      return {
        schedule: scheduleResult.schedule,
        cancelledAppointments,
        slotsRegenerated: {
          deletedAvailable: regenResult.deletedAvailable,
          created: regenResult.created,
        },
      };
    }

    return {
      schedule: scheduleResult.schedule,
      cancelledAppointments,
    };
  }
}
