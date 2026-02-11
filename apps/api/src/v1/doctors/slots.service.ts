import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

// Helper to convert UTC time to clinic local time string (HH:MM)
function utcToClinicTime(utcDate: Date, timezone: string): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(utcDate);
  const hour = parts.find(p => p.type === 'hour')?.value || '00';
  const minute = parts.find(p => p.type === 'minute')?.value || '00';
  return `${hour}:${minute}`;
}

// Helper to convert clinic local time to UTC
function clinicTimeToUTC(
  date: string,      // YYYY-MM-DD
  time: string,      // HH:MM
  timezone: string,  // IANA timezone
): Date {
  // Create a datetime string in the clinic's timezone
  // Then use Intl.DateTimeFormat to find the UTC offset and convert
  const [year, month, day] = date.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);

  // Create a date in UTC first
  const utcDate = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0, 0));

  // Get the offset between clinic timezone and UTC for this date/time
  // We need to find what UTC time corresponds to the given local time in the clinic
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  // Binary search for the correct UTC time
  // Start with an estimate (the UTC time as if it were local)
  let estimate = utcDate.getTime();

  for (let i = 0; i < 3; i++) {
    const testDate = new Date(estimate);
    const parts = formatter.formatToParts(testDate);

    const getPart = (type: string) => parts.find(p => p.type === type)?.value || '0';
    const localYear = parseInt(getPart('year'));
    const localMonth = parseInt(getPart('month'));
    const localDay = parseInt(getPart('day'));
    const localHour = parseInt(getPart('hour'));
    const localMinute = parseInt(getPart('minute'));

    // Calculate difference between desired local time and what we got
    const desiredMinutes = hours * 60 + minutes;
    const actualMinutes = localHour * 60 + localMinute;
    const dayDiff = (year * 10000 + month * 100 + day) - (localYear * 10000 + localMonth * 100 + localDay);

    const minutesDiff = desiredMinutes - actualMinutes + (dayDiff * 24 * 60);

    if (minutesDiff === 0) break;

    estimate += minutesDiff * 60 * 1000;
  }

  return new Date(estimate);
}

export type GeneratedSlot = {
  id: string;
  time: string;          // HH:MM format in clinic timezone
  startsAt: string;      // ISO datetime (UTC)
  endsAt: string;        // ISO datetime (UTC)
  shift: 'MORNING' | 'AFTERNOON';
  isAvailable: boolean;
};

export type SlotsGenerationResult = {
  slots: GeneratedSlot[];
  timezone: string;
  doctorDurationMin: number;
};

export type SlotsSummaryResult = {
  totalDays: number;
  workingDays: number;
  totalSlots: number;
  availableSlots: number;
  bookedSlots: number;
  timezone: string;
  doctorDurationMin: number;
};

@Injectable()
export class SlotsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Generate available appointment slots for a doctor on a specific date
   * Takes into account:
   * - Doctor's consultation duration
   * - Shift templates (MORNING, AFTERNOON times)
   * - Weekly shifts (which shifts are enabled for each day)
   * - Time off (blocked dates)
   * - Existing appointments (to mark slots as unavailable)
   */
  async generateSlots(
    clinicId: string,
    doctorId: string,
    date: string, // YYYY-MM-DD format
  ): Promise<SlotsGenerationResult> {
    // 1. Get clinic for timezone
    const clinic = await this.prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { timezone: true },
    });

    const timezone = clinic?.timezone || 'UTC';

    // 2. Get doctor with consultation duration
    const doctor = await this.prisma.doctor.findFirst({
      where: { id: doctorId, clinicId, isActive: true },
    });

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    // 2. Parse the date
    const targetDate = new Date(date + 'T00:00:00');
    if (isNaN(targetDate.getTime())) {
      throw new BadRequestException('Invalid date format. Use YYYY-MM-DD');
    }

    const dayOfWeek = targetDate.getDay(); // 0 = Sunday

    // 3. Check if date is within a time off period
    const timeOff = await this.prisma.doctorTimeOff.findFirst({
      where: {
        doctorId,
        startDate: { lte: targetDate },
        endDate: { gte: targetDate },
      },
    });

    if (timeOff) {
      // Doctor has time off on this date - return empty slots
      return {
        slots: [],
        timezone,
        doctorDurationMin: doctor.appointmentDurationMin,
      };
    }

    // 4. Get shift templates for this doctor
    const shiftTemplates = await this.prisma.doctorShiftTemplate.findMany({
      where: { doctorId },
    });

    // 5. Get weekly shifts for this day
    const weeklyShifts = await this.prisma.doctorWeeklyShift.findMany({
      where: { doctorId, dayOfWeek, isEnabled: true },
    });

    if (weeklyShifts.length === 0) {
      // No shifts enabled for this day
      return {
        slots: [],
        timezone,
        doctorDurationMin: doctor.appointmentDurationMin,
      };
    }

    // 6. Build shift time ranges for enabled shifts
    const enabledShifts = new Set(weeklyShifts.map(ws => ws.shiftType));
    const shiftRanges: { shift: 'MORNING' | 'AFTERNOON'; start: string; end: string }[] = [];

    for (const template of shiftTemplates) {
      if (enabledShifts.has(template.shiftType)) {
        shiftRanges.push({
          shift: template.shiftType as 'MORNING' | 'AFTERNOON',
          start: template.startTime,
          end: template.endTime,
        });
      }
    }

    // 7. Get existing appointments for this doctor on this date
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const existingAppointments = await this.prisma.appointment.findMany({
      where: {
        doctorId,
        startsAt: { gte: startOfDay, lte: endOfDay },
        status: { in: ['BOOKED', 'COMPLETED'] },
      },
      select: {
        startsAt: true,
        endsAt: true,
      },
    });

    // Create a set of booked time slots (in HH:MM format in clinic timezone)
    const bookedTimes = new Set<string>();
    for (const appt of existingAppointments) {
      const apptStart = new Date(appt.startsAt);
      const timeStr = utcToClinicTime(apptStart, timezone);
      bookedTimes.add(timeStr);
    }

    // 8. Generate slots for each shift range
    const slots: GeneratedSlot[] = [];
    const durationMin = doctor.appointmentDurationMin;

    for (const range of shiftRanges) {
      const [startHour, startMin] = range.start.split(':').map(Number);
      const [endHour, endMin] = range.end.split(':').map(Number);

      let currentHour = startHour;
      let currentMinute = startMin;

      while (true) {
        const currentTotalMinutes = currentHour * 60 + currentMinute;
        const endTotalMinutes = endHour * 60 + endMin;

        // Stop if we've reached the end of the shift
        if (currentTotalMinutes >= endTotalMinutes) {
          break;
        }

        // Calculate slot end time
        const slotEndMinutes = currentTotalMinutes + durationMin;

        // Don't create slots that extend past shift end
        if (slotEndMinutes > endTotalMinutes) {
          break;
        }

        const timeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;

        // Create slot start/end datetimes in clinic timezone
        const slotStart = clinicTimeToUTC(date, timeStr, timezone);

        const slotEndMinute = currentMinute + durationMin;
        const slotEndHour = currentHour + Math.floor(slotEndMinute / 60);
        const slotEndMin = slotEndMinute % 60;
        const endTimeStr = `${String(slotEndHour).padStart(2, '0')}:${String(slotEndMin).padStart(2, '0')}`;
        const slotEnd = clinicTimeToUTC(date, endTimeStr, timezone);

        slots.push({
          id: `slot-${date}-${timeStr}`,
          time: timeStr,
          startsAt: slotStart.toISOString(),
          endsAt: slotEnd.toISOString(),
          shift: range.shift,
          isAvailable: !bookedTimes.has(timeStr),
        });

        // Move to next slot
        currentMinute += durationMin;
        while (currentMinute >= 60) {
          currentMinute -= 60;
          currentHour += 1;
        }
      }
    }

    // Sort by time
    slots.sort((a, b) => a.startsAt.localeCompare(b.startsAt));

    return {
      slots,
      timezone,
      doctorDurationMin: doctor.appointmentDurationMin,
    };
  }

  /**
   * Generate slots for a date range (for bulk preview)
   * OPTIMIZED: Fetches all data upfront in batch queries instead of per-day queries
   */
  async generateSlotsForRange(
    clinicId: string,
    doctorId: string,
    startDate: string,
    endDate: string,
  ): Promise<{
    days: { date: string; slots: GeneratedSlot[] }[];
    timezone: string;
    doctorDurationMin: number;
  }> {
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T23:59:59');

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Invalid date format. Use YYYY-MM-DD');
    }

    // Limit to 30 days
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff > 30) {
      throw new BadRequestException('Date range cannot exceed 30 days');
    }

    // BATCH FETCH: Get all data upfront in parallel (6 queries total instead of 6 * numDays)
    const [clinic, doctor, shiftTemplates, weeklyShifts, timeOffs, appointments] = await Promise.all([
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
          // Get time offs that overlap with our date range
          OR: [
            { startDate: { lte: end }, endDate: { gte: start } },
          ],
        },
      }),
      this.prisma.appointment.findMany({
        where: {
          doctorId,
          startsAt: { gte: start, lte: end },
          status: { in: ['BOOKED', 'COMPLETED'] },
        },
        select: { startsAt: true, endsAt: true },
      }),
    ]);

    const timezone = clinic?.timezone || 'UTC';

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    const durationMin = doctor.appointmentDurationMin;

    // Build lookup maps for fast access
    const weeklyShiftsByDay = new Map<number, Set<string>>();
    for (const ws of weeklyShifts) {
      if (!weeklyShiftsByDay.has(ws.dayOfWeek)) {
        weeklyShiftsByDay.set(ws.dayOfWeek, new Set());
      }
      weeklyShiftsByDay.get(ws.dayOfWeek)!.add(ws.shiftType);
    }

    const shiftTemplateMap = new Map<string, { start: string; end: string }>();
    for (const st of shiftTemplates) {
      shiftTemplateMap.set(st.shiftType, { start: st.startTime, end: st.endTime });
    }

    // Build appointments by date for fast lookup (using clinic timezone)
    const appointmentsByDate = new Map<string, Set<string>>();
    for (const appt of appointments) {
      const apptStart = new Date(appt.startsAt);
      // Get date and time in clinic timezone
      const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone });
      const dateKey = formatter.format(apptStart); // YYYY-MM-DD
      if (!appointmentsByDate.has(dateKey)) {
        appointmentsByDate.set(dateKey, new Set());
      }
      const timeStr = utcToClinicTime(apptStart, timezone);
      appointmentsByDate.get(dateKey)!.add(timeStr);
    }

    // Helper to check if a date is within time off
    const isTimeOff = (date: Date): boolean => {
      for (const to of timeOffs) {
        if (date >= to.startDate && date <= to.endDate) {
          return true;
        }
      }
      return false;
    };

    // Generate slots for each day using cached data
    const results: { date: string; slots: GeneratedSlot[] }[] = [];
    const currentDate = new Date(start);

    while (currentDate <= end) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const dayOfWeek = currentDate.getDay();

      // Check time off
      if (isTimeOff(currentDate)) {
        results.push({ date: dateStr, slots: [] });
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
      }

      // Get enabled shifts for this day
      const enabledShifts = weeklyShiftsByDay.get(dayOfWeek);
      if (!enabledShifts || enabledShifts.size === 0) {
        results.push({ date: dateStr, slots: [] });
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
      }

      // Get booked times for this date
      const bookedTimes = appointmentsByDate.get(dateStr) || new Set<string>();

      // Generate slots for enabled shifts
      const slots: GeneratedSlot[] = [];

      for (const shiftType of enabledShifts) {
        const template = shiftTemplateMap.get(shiftType);
        if (!template) continue;

        const [startHour, startMin] = template.start.split(':').map(Number);
        const [endHour, endMin] = template.end.split(':').map(Number);

        let currentHour = startHour;
        let currentMinute = startMin;

        while (true) {
          const currentTotalMinutes = currentHour * 60 + currentMinute;
          const endTotalMinutes = endHour * 60 + endMin;

          if (currentTotalMinutes >= endTotalMinutes) break;

          const slotEndMinutes = currentTotalMinutes + durationMin;
          if (slotEndMinutes > endTotalMinutes) break;

          const timeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;

          // Create slot start/end datetimes in clinic timezone
          const slotStart = clinicTimeToUTC(dateStr, timeStr, timezone);

          const slotEndMinute = currentMinute + durationMin;
          const slotEndHour = currentHour + Math.floor(slotEndMinute / 60);
          const slotEndMin = slotEndMinute % 60;
          const endTimeStr = `${String(slotEndHour).padStart(2, '0')}:${String(slotEndMin).padStart(2, '0')}`;
          const slotEnd = clinicTimeToUTC(dateStr, endTimeStr, timezone);

          slots.push({
            id: `slot-${dateStr}-${timeStr}`,
            time: timeStr,
            startsAt: slotStart.toISOString(),
            endsAt: slotEnd.toISOString(),
            shift: shiftType as 'MORNING' | 'AFTERNOON',
            isAvailable: !bookedTimes.has(timeStr),
          });

          currentMinute += durationMin;
          while (currentMinute >= 60) {
            currentMinute -= 60;
            currentHour += 1;
          }
        }
      }

      slots.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
      results.push({ date: dateStr, slots });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return {
      days: results,
      timezone,
      doctorDurationMin: durationMin,
    };
  }

  /**
   * Get slot generation summary for a doctor
   */
  async getSlotsSummary(
    clinicId: string,
    doctorId: string,
    startDate: string,
    endDate: string,
  ): Promise<SlotsSummaryResult> {
    const slotsData = await this.generateSlotsForRange(clinicId, doctorId, startDate, endDate);

    let totalSlots = 0;
    let availableSlots = 0;
    let workingDays = 0;

    for (const day of slotsData.days) {
      if (day.slots.length > 0) {
        workingDays++;
        totalSlots += day.slots.length;
        availableSlots += day.slots.filter(s => s.isAvailable).length;
      }
    }

    return {
      totalDays: slotsData.days.length,
      workingDays,
      totalSlots,
      availableSlots,
      bookedSlots: totalSlots - availableSlots,
      timezone: slotsData.timezone,
      doctorDurationMin: slotsData.doctorDurationMin,
    };
  }
}
