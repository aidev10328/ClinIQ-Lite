import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { TimezoneService } from '../../common/timezone.service';
import { Prisma, ShiftType, SlotStatus, Slot } from '@prisma/client';

export type ImpactedAppointment = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  patientName: string;
  patientPhone: string;
  reason: string;
};

export type SlotGenerationResult = {
  slotsCreated: number;
  startDate: string;
  endDate: string;
};

export type SlotDeletionResult = {
  deletedCount: number;
  bookedAppointments: ImpactedAppointment[];
};

export type ScheduleImpactResult = {
  impactedAppointments: ImpactedAppointment[];
  totalImpacted: number;
};

export type UpdateSchedulePayload = {
  appointmentDurationMin?: number;
  shiftTemplate?: Record<ShiftType, { start: string; end: string }>;
  weekly?: Array<{ dayOfWeek: number; shifts: Record<ShiftType, boolean> }>;
};

@Injectable()
export class PersistentSlotsService {
  constructor(
    private prisma: PrismaService,
    private timezoneService: TimezoneService,
  ) {}

  /**
   * Check if a doctor's schedule is fully configured
   * (has duration, at least one shift template, and at least one weekly shift enabled)
   */
  async isScheduleFullyConfigured(doctorId: string): Promise<boolean> {
    const [doctor, shiftTemplates, weeklyShifts] = await Promise.all([
      this.prisma.doctor.findUnique({
        where: { id: doctorId },
        select: { appointmentDurationMin: true },
      }),
      this.prisma.doctorShiftTemplate.findMany({
        where: { doctorId },
      }),
      this.prisma.doctorWeeklyShift.findMany({
        where: { doctorId, isEnabled: true },
      }),
    ]);

    return (
      doctor?.appointmentDurationMin !== undefined &&
      doctor.appointmentDurationMin > 0 &&
      shiftTemplates.length > 0 &&
      weeklyShifts.length > 0
    );
  }

  /**
   * Generate slots for a doctor within a specified date range (admin-triggered)
   * Stores the generation range on the doctor record for future regeneration
   *
   * @param clinicId - The clinic ID
   * @param doctorId - The doctor ID
   * @param startDateStr - Start date in YYYY-MM-DD format (clinic timezone)
   * @param endDateStr - End date in YYYY-MM-DD format (clinic timezone)
   */
  async generateSlotsForRange(
    clinicId: string,
    doctorId: string,
    startDateStr: string,
    endDateStr: string,
  ): Promise<SlotGenerationResult> {
    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDateStr) || !dateRegex.test(endDateStr)) {
      throw new BadRequestException('Invalid date format. Use YYYY-MM-DD');
    }

    // Get clinic timezone
    const clinic = await this.prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { timezone: true },
    });
    const timezone = clinic?.timezone || 'UTC';

    // Check if doctor exists and has schedule configured
    const doctor = await this.prisma.doctor.findFirst({
      where: { id: doctorId, clinicId, isActive: true },
    });

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    // Check if schedule is fully configured
    const isConfigured = await this.isScheduleFullyConfigured(doctorId);
    if (!isConfigured) {
      throw new BadRequestException('Doctor schedule is not fully configured. Please set duration, shift templates, and weekly schedule first.');
    }

    // Parse dates for generation
    const startDate = this.timezoneService.parseDateInTimezone(startDateStr, timezone);
    const endDate = this.timezoneService.parseDateInTimezone(endDateStr, timezone);

    if (startDate > endDate) {
      throw new BadRequestException('Start date must be before or equal to end date');
    }

    // Delete existing slots in the range first (preserving booked ones)
    await this.prisma.slot.deleteMany({
      where: {
        clinicId,
        doctorId,
        date: {
          gte: this.timezoneService.toUtcMidnight(startDateStr),
          lte: this.timezoneService.toUtcMidnight(endDateStr),
        },
        status: 'AVAILABLE', // Only delete available slots
      },
    });

    // Generate new slots
    const result = await this.generateAndPersistSlots(clinicId, doctorId, startDate, endDate);

    // Store the generation range on the doctor record
    await this.prisma.doctor.update({
      where: { id: doctorId },
      data: {
        scheduleConfiguredAt: doctor.scheduleConfiguredAt || new Date(),
        slotsGeneratedFrom: this.timezoneService.toUtcMidnight(startDateStr),
        slotsGeneratedTo: this.timezoneService.toUtcMidnight(endDateStr),
      },
    });

    return {
      slotsCreated: result.created,
      startDate: startDateStr,
      endDate: endDateStr,
    };
  }

  /**
   * Get the stored slot generation range for a doctor
   */
  async getSlotGenerationRange(
    doctorId: string,
  ): Promise<{ from: string | null; to: string | null }> {
    const doctor = await this.prisma.doctor.findUnique({
      where: { id: doctorId },
      select: {
        slotsGeneratedFrom: true,
        slotsGeneratedTo: true,
        clinic: { select: { timezone: true } },
      },
    });

    if (!doctor) {
      return { from: null, to: null };
    }

    const timezone = doctor.clinic?.timezone || 'UTC';

    return {
      from: doctor.slotsGeneratedFrom
        ? this.timezoneService.formatDateInTimezone(doctor.slotsGeneratedFrom, timezone)
        : null,
      to: doctor.slotsGeneratedTo
        ? this.timezoneService.formatDateInTimezone(doctor.slotsGeneratedTo, timezone)
        : null,
    };
  }

  /**
   * Generate and persist slots for a doctor within a date range
   * Uses batch inserts for performance (chunks of 500)
   * All slot times are created in the clinic's timezone
   */
  async generateAndPersistSlots(
    clinicId: string,
    doctorId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{ created: number; skipped: number }> {
    // Fetch all required data
    const [clinic, doctor, shiftTemplates, weeklyShifts, timeOffs] = await Promise.all([
      this.prisma.clinic.findUnique({
        where: { id: clinicId },
        select: { timezone: true },
      }),
      this.prisma.doctor.findFirst({
        where: { id: doctorId, clinicId, isActive: true },
      }),
      this.prisma.doctorShiftTemplate.findMany({
        where: { doctorId },
      }),
      this.prisma.doctorWeeklyShift.findMany({
        where: { doctorId, isEnabled: true },
      }),
      this.prisma.doctorTimeOff.findMany({
        where: {
          doctorId,
          OR: [{ startDate: { lte: endDate }, endDate: { gte: startDate } }],
        },
      }),
    ]);

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    // Only generate slots for licensed doctors
    if (!doctor.hasLicense) {
      return { created: 0, skipped: 0 };
    }

    if (shiftTemplates.length === 0 || weeklyShifts.length === 0) {
      return { created: 0, skipped: 0 };
    }

    const timezone = clinic?.timezone || 'UTC';
    const durationMin = doctor.appointmentDurationMin;

    // Build lookup maps
    const weeklyShiftsByDay = new Map<number, Set<ShiftType>>();
    for (const ws of weeklyShifts) {
      if (!weeklyShiftsByDay.has(ws.dayOfWeek)) {
        weeklyShiftsByDay.set(ws.dayOfWeek, new Set());
      }
      weeklyShiftsByDay.get(ws.dayOfWeek)!.add(ws.shiftType);
    }

    const shiftTemplateMap = new Map<ShiftType, { start: string; end: string }>();
    for (const st of shiftTemplates) {
      shiftTemplateMap.set(st.shiftType, { start: st.startTime, end: st.endTime });
    }

    // Helper to check if a date is within time off (comparing calendar dates only)
    const isTimeOff = (dateStr: string): boolean => {
      for (const to of timeOffs) {
        const startStr = this.timezoneService.formatDateInTimezone(to.startDate, timezone);
        const endStr = this.timezoneService.formatDateInTimezone(to.endDate, timezone);
        if (dateStr >= startStr && dateStr <= endStr) {
          return true;
        }
      }
      return false;
    };

    // Generate all slot data
    const slotsToCreate: Prisma.SlotCreateManyInput[] = [];

    // Iterate through dates using clinic timezone
    let currentDateStr = this.timezoneService.formatDateInTimezone(startDate, timezone);
    const endDateStr = this.timezoneService.formatDateInTimezone(endDate, timezone);

    while (currentDateStr <= endDateStr) {
      // Get day of week for this date in clinic timezone
      const currentDateInTz = this.timezoneService.parseDateInTimezone(currentDateStr, timezone);
      const dayOfWeek = this.timezoneService.getDayOfWeekInTimezone(currentDateInTz, timezone);

      // Skip time off days
      if (!isTimeOff(currentDateStr)) {
        const enabledShifts = weeklyShiftsByDay.get(dayOfWeek);

        if (enabledShifts && enabledShifts.size > 0) {
          for (const shiftType of enabledShifts) {
            const template = shiftTemplateMap.get(shiftType);
            if (!template) continue;

            const [startHour, startMin] = template.start.split(':').map(Number);
            const [endHour, endMin] = template.end.split(':').map(Number);

            // Handle overnight shifts (e.g., 22:00 - 06:00)
            const isOvernightShift = endHour < startHour || (endHour === startHour && endMin < startMin);

            let currentTotalMinutes = startHour * 60 + startMin;
            const endTotalMinutes = (endHour * 60 + endMin) + (isOvernightShift ? 1440 : 0);

            while (currentTotalMinutes + durationMin <= endTotalMinutes) {
              // Calculate actual hour/minute, handling overflow past midnight
              const actualHour = Math.floor(currentTotalMinutes / 60) % 24;
              const actualMinute = currentTotalMinutes % 60;
              const isPastMidnight = currentTotalMinutes >= 1440;

              // Determine the actual date for this slot
              let slotDateStr = currentDateStr;
              if (isPastMidnight) {
                // Move to next day
                const nextDay = this.timezoneService.addDaysInTimezone(currentDateInTz, 1, timezone);
                slotDateStr = this.timezoneService.formatDateInTimezone(nextDay, timezone);
              }

              // Create time string (HH:MM)
              const timeStr = `${String(actualHour).padStart(2, '0')}:${String(actualMinute).padStart(2, '0')}`;

              // Create slot start time in clinic timezone (will be stored as UTC)
              const slotStart = this.timezoneService.createDateInTimezone(slotDateStr, timeStr, timezone);

              // Create slot end time
              const endMinutes = actualMinute + durationMin;
              const endHourCalc = actualHour + Math.floor(endMinutes / 60);
              const endMinCalc = endMinutes % 60;
              const endTimeStr = `${String(endHourCalc % 24).padStart(2, '0')}:${String(endMinCalc).padStart(2, '0')}`;
              const slotEnd = this.timezoneService.createDateInTimezone(slotDateStr, endTimeStr, timezone);

              // For @db.Date fields, use UTC midnight for consistent storage and querying
              const slotDate = this.timezoneService.toUtcMidnight(currentDateStr);

              slotsToCreate.push({
                clinicId,
                doctorId,
                date: slotDate, // UTC midnight for @db.Date field
                startsAt: slotStart,
                endsAt: slotEnd,
                shiftType,
                status: 'AVAILABLE',
              });

              currentTotalMinutes += durationMin;
            }
          }
        }
      }

      // Move to next day
      const nextDate = this.timezoneService.addDaysInTimezone(
        this.timezoneService.parseDateInTimezone(currentDateStr, timezone),
        1,
        timezone,
      );
      currentDateStr = this.timezoneService.formatDateInTimezone(nextDate, timezone);
    }

    // Batch insert slots (chunks of 500)
    let created = 0;
    const chunkSize = 500;

    for (let i = 0; i < slotsToCreate.length; i += chunkSize) {
      const chunk = slotsToCreate.slice(i, i + chunkSize);
      const result = await this.prisma.slot.createMany({
        data: chunk,
        skipDuplicates: true,
      });
      created += result.count;
    }

    return {
      created,
      skipped: slotsToCreate.length - created,
    };
  }

  /**
   * Delete slots for a date range (for time-off)
   * Returns list of booked appointments that would be affected
   */
  async deleteSlotsForDateRange(
    clinicId: string,
    doctorId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<SlotDeletionResult> {
    // Find all slots in the date range
    const slots = await this.prisma.slot.findMany({
      where: {
        clinicId,
        doctorId,
        date: { gte: startDate, lte: endDate },
      },
      include: {
        appointment: {
          include: {
            patient: { select: { fullName: true, phone: true } },
          },
        },
      },
    });

    // Separate available and booked slots
    const bookedSlots = slots.filter(s => s.status === 'BOOKED' && s.appointment);
    const availableSlots = slots.filter(s => s.status === 'AVAILABLE');

    // Build list of impacted appointments
    const bookedAppointments: ImpactedAppointment[] = bookedSlots.map(slot => ({
      id: slot.appointment!.id,
      startsAt: slot.appointment!.startsAt,
      endsAt: slot.appointment!.endsAt,
      patientName: slot.appointment!.patient.fullName,
      patientPhone: slot.appointment!.patient.phone,
      reason: 'Time-off added for this date',
    }));

    // Delete only available slots
    const deleteResult = await this.prisma.slot.deleteMany({
      where: {
        id: { in: availableSlots.map(s => s.id) },
      },
    });

    return {
      deletedCount: deleteResult.count,
      bookedAppointments,
    };
  }

  /**
   * Force delete all slots for a date range (including booked)
   * Should be called after user confirms cancellation of booked appointments
   */
  async forceDeleteSlotsForDateRange(
    clinicId: string,
    doctorId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{ deletedSlots: number; cancelledAppointments: number }> {
    return this.prisma.$transaction(async (tx) => {
      // Cancel all appointments in the range
      const cancelResult = await tx.appointment.updateMany({
        where: {
          clinicId,
          doctorId,
          startsAt: { gte: startDate },
          endsAt: { lte: new Date(endDate.getTime() + 24 * 60 * 60 * 1000) },
          status: 'BOOKED',
        },
        data: { status: 'CANCELLED' },
      });

      // Delete all slots
      const deleteResult = await tx.slot.deleteMany({
        where: {
          clinicId,
          doctorId,
          date: { gte: startDate, lte: endDate },
        },
      });

      return {
        deletedSlots: deleteResult.count,
        cancelledAppointments: cancelResult.count,
      };
    });
  }

  /**
   * Restore slots when time-off is deleted
   */
  async restoreSlotsForDateRange(
    clinicId: string,
    doctorId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{ restored: number }> {
    const result = await this.generateAndPersistSlots(clinicId, doctorId, startDate, endDate);
    return { restored: result.created };
  }

  /**
   * Get impacted appointments when schedule changes
   * Checks which booked appointments fall outside the proposed schedule
   */
  async getImpactedAppointments(
    clinicId: string,
    doctorId: string,
    proposedChanges: UpdateSchedulePayload,
  ): Promise<ScheduleImpactResult> {
    // Get clinic timezone
    const clinic = await this.prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { timezone: true },
    });
    const timezone = clinic?.timezone || 'UTC';

    const today = this.timezoneService.getClinicDate(timezone);

    // Get current schedule data
    const [doctor, currentShiftTemplates, currentWeeklyShifts] = await Promise.all([
      this.prisma.doctor.findUnique({
        where: { id: doctorId },
        select: { appointmentDurationMin: true },
      }),
      this.prisma.doctorShiftTemplate.findMany({
        where: { doctorId },
      }),
      this.prisma.doctorWeeklyShift.findMany({
        where: { doctorId },
      }),
    ]);

    // Build proposed schedule (merge current with changes)
    const proposedDuration = proposedChanges.appointmentDurationMin ?? doctor?.appointmentDurationMin ?? 15;

    const proposedShiftTemplates = new Map<ShiftType, { start: string; end: string }>();
    for (const st of currentShiftTemplates) {
      proposedShiftTemplates.set(st.shiftType, { start: st.startTime, end: st.endTime });
    }
    if (proposedChanges.shiftTemplate) {
      for (const [shift, times] of Object.entries(proposedChanges.shiftTemplate)) {
        proposedShiftTemplates.set(shift as ShiftType, times);
      }
    }

    const proposedWeeklyShifts = new Map<number, Map<ShiftType, boolean>>();
    for (const ws of currentWeeklyShifts) {
      if (!proposedWeeklyShifts.has(ws.dayOfWeek)) {
        proposedWeeklyShifts.set(ws.dayOfWeek, new Map());
      }
      proposedWeeklyShifts.get(ws.dayOfWeek)!.set(ws.shiftType, ws.isEnabled);
    }
    if (proposedChanges.weekly) {
      for (const day of proposedChanges.weekly) {
        if (!proposedWeeklyShifts.has(day.dayOfWeek)) {
          proposedWeeklyShifts.set(day.dayOfWeek, new Map());
        }
        for (const [shift, enabled] of Object.entries(day.shifts)) {
          proposedWeeklyShifts.get(day.dayOfWeek)!.set(shift as ShiftType, enabled);
        }
      }
    }

    // Get all future booked appointments
    const futureAppointments = await this.prisma.appointment.findMany({
      where: {
        clinicId,
        doctorId,
        startsAt: { gte: today },
        status: 'BOOKED',
      },
      include: {
        patient: { select: { fullName: true, phone: true } },
      },
      orderBy: { startsAt: 'asc' },
    });

    // Check each appointment against proposed schedule
    const impactedAppointments: ImpactedAppointment[] = [];

    for (const appt of futureAppointments) {
      // Get appointment time in clinic timezone
      const apptStart = this.timezoneService.convertToTimezone(new Date(appt.startsAt), timezone);
      const dayOfWeek = apptStart.getDay();
      const apptHour = apptStart.getHours();
      const apptMinute = apptStart.getMinutes();
      const apptTotalMinutes = apptHour * 60 + apptMinute;

      let reason = '';

      // Check if day/shift is still enabled
      const dayShifts = proposedWeeklyShifts.get(dayOfWeek);
      if (!dayShifts) {
        reason = `No shifts configured for ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek]}`;
      } else {
        // Find which shift this appointment falls into
        let fitsInShift = false;

        for (const [shiftType, isEnabled] of dayShifts) {
          if (!isEnabled) continue;

          const template = proposedShiftTemplates.get(shiftType);
          if (!template) continue;

          const [startHour, startMin] = template.start.split(':').map(Number);
          const [endHour, endMin] = template.end.split(':').map(Number);
          const shiftStartMinutes = startHour * 60 + startMin;
          const shiftEndMinutes = endHour * 60 + endMin;

          // Check if appointment fits within this shift
          if (apptTotalMinutes >= shiftStartMinutes && apptTotalMinutes + proposedDuration <= shiftEndMinutes) {
            // Check if it aligns with the new slot grid
            const minutesSinceShiftStart = apptTotalMinutes - shiftStartMinutes;
            if (minutesSinceShiftStart % proposedDuration === 0) {
              fitsInShift = true;
              break;
            } else {
              reason = `Time ${apptHour}:${String(apptMinute).padStart(2, '0')} doesn't align with new ${proposedDuration}-minute slot grid`;
            }
          }
        }

        if (!fitsInShift && !reason) {
          reason = `Appointment time falls outside new shift hours`;
        }

        if (!fitsInShift) {
          impactedAppointments.push({
            id: appt.id,
            startsAt: appt.startsAt,
            endsAt: appt.endsAt,
            patientName: appt.patient.fullName,
            patientPhone: appt.patient.phone,
            reason,
          });
        }
      }
    }

    return {
      impactedAppointments,
      totalImpacted: impactedAppointments.length,
    };
  }

  /**
   * Regenerate slots after schedule change
   * Uses the stored slot generation range (slotsGeneratedFrom → slotsGeneratedTo)
   * Only regenerates from today to the stored end date (not the full year)
   * Preserves booked appointments, regenerates available slots
   */
  async regenerateSlotsAfterScheduleChange(
    clinicId: string,
    doctorId: string,
    cancelImpactedAppointments: boolean = false,
  ): Promise<{
    deletedAvailable: number;
    created: number;
    cancelledAppointments: number;
    skipped: boolean;
    skipReason?: string;
  }> {
    // Get clinic timezone and doctor's slot generation range
    const [clinic, doctor] = await Promise.all([
      this.prisma.clinic.findUnique({
        where: { id: clinicId },
        select: { timezone: true },
      }),
      this.prisma.doctor.findUnique({
        where: { id: doctorId },
        select: { slotsGeneratedFrom: true, slotsGeneratedTo: true },
      }),
    ]);

    const timezone = clinic?.timezone || 'UTC';

    // Check if slots were ever generated for this doctor
    if (!doctor?.slotsGeneratedFrom || !doctor?.slotsGeneratedTo) {
      return {
        deletedAvailable: 0,
        created: 0,
        cancelledAppointments: 0,
        skipped: true,
        skipReason: 'No slots have been generated for this doctor yet. Use admin slot generation first.',
      };
    }

    // For @db.Date field queries, use UTC midnight
    const today = this.timezoneService.getClinicDateUtcMidnight(timezone);
    const storedEndDate = doctor.slotsGeneratedTo;

    // If the stored end date is in the past, nothing to regenerate
    if (storedEndDate < today) {
      return {
        deletedAvailable: 0,
        created: 0,
        cancelledAppointments: 0,
        skipped: true,
        skipReason: 'Stored slot generation range is in the past. Generate new slots first.',
      };
    }

    // Regenerate from today to the stored end date
    const startDate = today;
    const endDate = storedEndDate;

    return this.prisma.$transaction(async (tx) => {
      let cancelledAppointments = 0;

      if (cancelImpactedAppointments) {
        // Get impacted appointments
        const impact = await this.getImpactedAppointments(clinicId, doctorId, {});

        // Cancel impacted appointments
        if (impact.impactedAppointments.length > 0) {
          const result = await tx.appointment.updateMany({
            where: {
              id: { in: impact.impactedAppointments.map(a => a.id) },
            },
            data: { status: 'CANCELLED' },
          });
          cancelledAppointments = result.count;

          // Release their slots
          await tx.slot.updateMany({
            where: {
              appointmentId: { in: impact.impactedAppointments.map(a => a.id) },
            },
            data: {
              status: 'AVAILABLE',
              appointmentId: null,
            },
          });
        }
      }

      // Delete AVAILABLE slots within the regeneration range
      const deleteResult = await tx.slot.deleteMany({
        where: {
          clinicId,
          doctorId,
          date: { gte: startDate, lte: endDate },
          status: 'AVAILABLE',
        },
      });

      return {
        deletedAvailable: deleteResult.count,
        created: 0, // Will be populated after transaction
        cancelledAppointments,
      };
    }).then(async (txResult) => {
      // Generate new slots outside transaction
      const genResult = await this.generateAndPersistSlots(clinicId, doctorId, startDate, endDate);

      return {
        ...txResult,
        created: genResult.created,
        skipped: false,
      };
    });
  }

  /**
   * Book a slot (called when appointment is created)
   */
  async bookSlot(slotId: string, appointmentId: string): Promise<Slot> {
    return this.prisma.slot.update({
      where: { id: slotId },
      data: {
        status: 'BOOKED',
        appointmentId,
      },
    });
  }

  /**
   * Release a slot (called when appointment is cancelled)
   */
  async releaseSlot(appointmentId: string): Promise<Slot | null> {
    const slot = await this.prisma.slot.findFirst({
      where: { appointmentId },
    });

    if (!slot) return null;

    return this.prisma.slot.update({
      where: { id: slot.id },
      data: {
        status: 'AVAILABLE',
        appointmentId: null,
      },
    });
  }

  /**
   * Get available slots for a date
   * Date string should be in YYYY-MM-DD format (clinic's local date)
   */
  async getAvailableSlots(
    clinicId: string,
    doctorId: string,
    date: string,
  ): Promise<Slot[]> {
    // For @db.Date fields, use UTC midnight for consistent querying
    const targetDate = this.timezoneService.toUtcMidnight(date);

    return this.prisma.slot.findMany({
      where: {
        clinicId,
        doctorId,
        date: targetDate,
        status: 'AVAILABLE',
      },
      orderBy: { startsAt: 'asc' },
    });
  }

  /**
   * Get all slots for a date (including booked)
   * Includes appointment details with patient info for booked slots
   * Date string should be in YYYY-MM-DD format (clinic's local date)
   */
  async getSlotsForDate(
    clinicId: string,
    doctorId: string,
    date: string,
  ) {
    // For @db.Date fields, use UTC midnight for consistent querying
    const targetDate = this.timezoneService.toUtcMidnight(date);

    return this.prisma.slot.findMany({
      where: {
        clinicId,
        doctorId,
        date: targetDate,
      },
      include: {
        appointment: {
          select: {
            id: true,
            reason: true,
            status: true,
            patient: {
              select: {
                id: true,
                fullName: true,
                phone: true,
              },
            },
          },
        },
      },
      orderBy: { startsAt: 'asc' },
    });
  }

  /**
   * Get slots for a date range
   */
  async getSlotsForRange(
    clinicId: string,
    doctorId: string,
    startDate: string,
    endDate: string,
  ): Promise<{ date: string; slots: Slot[] }[]> {
    // For @db.Date fields, use UTC midnight for consistent querying
    const start = this.timezoneService.toUtcMidnight(startDate);
    const end = this.timezoneService.toUtcMidnight(endDate);

    const slots = await this.prisma.slot.findMany({
      where: {
        clinicId,
        doctorId,
        date: { gte: start, lte: end },
      },
      orderBy: [{ date: 'asc' }, { startsAt: 'asc' }],
    });

    // Group by date
    const slotsByDate = new Map<string, Slot[]>();
    for (const slot of slots) {
      const dateStr = slot.date.toISOString().split('T')[0];
      if (!slotsByDate.has(dateStr)) {
        slotsByDate.set(dateStr, []);
      }
      slotsByDate.get(dateStr)!.push(slot);
    }

    const results: { date: string; slots: Slot[] }[] = [];
    const currentDate = new Date(start);

    while (currentDate <= end) {
      const dateStr = currentDate.toISOString().split('T')[0];
      results.push({
        date: dateStr,
        slots: slotsByDate.get(dateStr) || [],
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return results;
  }

  /**
   * Find a specific slot by doctor and start time
   */
  async findSlotByTime(
    doctorId: string,
    startsAt: Date,
  ): Promise<Slot | null> {
    return this.prisma.slot.findUnique({
      where: {
        doctorId_startsAt: {
          doctorId,
          startsAt,
        },
      },
    });
  }

  /**
   * Get slot statistics for a doctor
   */
  async getSlotStats(
    clinicId: string,
    doctorId: string,
    startDate: string,
    endDate: string,
  ): Promise<{
    totalSlots: number;
    availableSlots: number;
    bookedSlots: number;
    blockedSlots: number;
  }> {
    // For @db.Date fields, use UTC midnight for consistent querying
    const start = this.timezoneService.toUtcMidnight(startDate);
    const end = this.timezoneService.toUtcMidnight(endDate);

    const stats = await this.prisma.slot.groupBy({
      by: ['status'],
      where: {
        clinicId,
        doctorId,
        date: { gte: start, lte: end },
      },
      _count: { id: true },
    });

    const result = {
      totalSlots: 0,
      availableSlots: 0,
      bookedSlots: 0,
      blockedSlots: 0,
    };

    for (const stat of stats) {
      const count = stat._count.id;
      result.totalSlots += count;

      switch (stat.status) {
        case 'AVAILABLE':
          result.availableSlots = count;
          break;
        case 'BOOKED':
          result.bookedSlots = count;
          break;
        case 'BLOCKED':
          result.blockedSlots = count;
          break;
      }
    }

    return result;
  }
}
