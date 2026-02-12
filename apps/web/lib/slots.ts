'use client';

import type { DoctorSchedule, Appointment, GeneratedSlot } from './api';

export type SlotPeriod = 'morning' | 'evening';

export type Slot = {
  id: string;
  time: string;          // HH:MM format
  startsAt: Date;        // Full datetime
  endsAt: Date;          // Full datetime
  period: SlotPeriod;
  isBooked: boolean;
  isPast?: boolean;      // True if slot time is before current clinic time
  appointment?: Appointment;
};

export type SlotsByPeriod = {
  morning: Slot[];
  evening: Slot[];
};

// Period definitions (in 24-hour format)
const PERIOD_RANGES = {
  morning: { start: 0, end: 12 },     // 00:00 - 11:59
  evening: { start: 12, end: 24 },  // 12:00 - 23:59
};

export function getPeriodLabel(period: SlotPeriod): string {
  switch (period) {
    case 'morning': return 'Morning';
    case 'evening': return 'Evening';
  }
}

export function getPeriodForTime(hour: number): SlotPeriod {
  if (hour < 12) return 'morning';
  return 'evening';
}

// Parse HH:MM time string to hours and minutes
function parseTime(timeStr: string): { hours: number; minutes: number } {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return { hours, minutes };
}

// Format time as HH:MM
export function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

// Format time from HH:MM string (24h) to 12h format
// Does not use Date objects to avoid timezone issues
export function formatTimeFromString(timeStr: string): string {
  const { hours, minutes } = parseTime(timeStr);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12; // Convert 0 to 12 for midnight
  const displayMinutes = String(minutes).padStart(2, '0');
  return `${displayHours}:${displayMinutes} ${period}`;
}

/**
 * Generate slots for a specific date based on doctor's schedule
 */
export function generateSlots(
  schedules: DoctorSchedule[],
  slotDurationMin: number,
  date: Date
): Slot[] {
  const slots: Slot[] = [];
  const dayOfWeek = date.getDay(); // 0 = Sunday

  // Find schedules for this day of week
  const todaySchedules = schedules.filter(
    s => s.dayOfWeek === dayOfWeek && s.isEnabled
  );

  if (todaySchedules.length === 0) {
    return slots;
  }

  for (const schedule of todaySchedules) {
    const startParsed = parseTime(schedule.startTime);
    const endParsed = parseTime(schedule.endTime);

    // Create a slot for each interval
    let currentHour = startParsed.hours;
    let currentMinute = startParsed.minutes;

    while (true) {
      // Check if we've passed the end time
      const currentTotalMinutes = currentHour * 60 + currentMinute;
      const endTotalMinutes = endParsed.hours * 60 + endParsed.minutes;

      if (currentTotalMinutes >= endTotalMinutes) {
        break;
      }

      // Create slot
      const slotStart = new Date(date);
      slotStart.setHours(currentHour, currentMinute, 0, 0);

      const slotEnd = new Date(slotStart);
      slotEnd.setMinutes(slotEnd.getMinutes() + slotDurationMin);

      // Don't create slots that extend past schedule end
      if (slotEnd.getHours() * 60 + slotEnd.getMinutes() > endTotalMinutes) {
        break;
      }

      const timeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;

      slots.push({
        id: `slot-${timeStr}`,
        time: timeStr,
        startsAt: slotStart,
        endsAt: slotEnd,
        period: getPeriodForTime(currentHour),
        isBooked: false,
      });

      // Move to next slot
      currentMinute += slotDurationMin;
      while (currentMinute >= 60) {
        currentMinute -= 60;
        currentHour += 1;
      }
    }
  }

  // Sort by time
  slots.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  return slots;
}

/**
 * Merge appointments into slots
 * Matches by comparing slot time with appointment startsAt
 */
export function mergeAppointmentsIntoSlots(
  slots: Slot[],
  appointments: Appointment[]
): Slot[] {
  // Create multiple lookup maps for robust matching
  const appointmentsByTimeStr: Record<string, Appointment> = {};
  const appointmentsByTimestamp: Record<number, Appointment> = {};

  for (const appt of appointments) {
    if (appt.status === 'BOOKED') {
      const apptDate = new Date(appt.startsAt);
      // Match by time string (HH:MM)
      const timeStr = `${String(apptDate.getHours()).padStart(2, '0')}:${String(apptDate.getMinutes()).padStart(2, '0')}`;
      appointmentsByTimeStr[timeStr] = appt;
      // Also match by timestamp for reliability
      appointmentsByTimestamp[apptDate.getTime()] = appt;
    }
  }

  // Merge appointments into slots
  return slots.map(slot => {
    // Try to find matching appointment by time string or timestamp
    const appt = appointmentsByTimeStr[slot.time] || appointmentsByTimestamp[slot.startsAt.getTime()];
    if (appt) {
      return {
        ...slot,
        isBooked: true,
        appointment: appt,
      };
    }
    return slot;
  });
}

/**
 * Group slots by period
 */
export function groupSlotsByPeriod(slots: Slot[]): SlotsByPeriod {
  const result: SlotsByPeriod = {
    morning: [],
    evening: [],
  };

  for (const slot of slots) {
    result[slot.period].push(slot);
  }

  return result;
}

/**
 * Mark slots as past based on current clinic time
 * @param slots - Array of slots
 * @param clinicNow - Current time in clinic timezone
 */
export function markPastSlots(slots: Slot[], clinicNow: Date): Slot[] {
  const nowTime = clinicNow.getTime();
  return slots.map(slot => ({
    ...slot,
    isPast: slot.startsAt.getTime() < nowTime,
  }));
}

/**
 * Count open/booked slots
 */
export function countSlots(slots: Slot[]): { open: number; booked: number } {
  let open = 0;
  let booked = 0;

  for (const slot of slots) {
    if (slot.isBooked) {
      booked++;
    } else {
      open++;
    }
  }

  return { open, booked };
}

/**
 * Format date for display
 */
export function formatDateDisplay(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format date as YYYY-MM-DD for API
 * Uses local date components to avoid timezone issues
 */
export function formatDateForApi(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Convert backend GeneratedSlot to frontend Slot format
 */
export function convertBackendSlotToFrontend(
  backendSlot: GeneratedSlot,
  date: Date
): Slot {
  const startsAt = new Date(backendSlot.startsAt);
  const endsAt = new Date(backendSlot.endsAt);

  // Determine period based on the actual time (HH:MM format)
  // This is more reliable than trusting the stored shift type
  const { hours } = parseTime(backendSlot.time);
  const period = getPeriodForTime(hours);

  const slot: Slot = {
    id: backendSlot.id,
    time: backendSlot.time,
    startsAt,
    endsAt,
    period,
    isBooked: !backendSlot.isAvailable,
  };

  // Include appointment data if present (for booked slots)
  if (backendSlot.appointment) {
    slot.appointment = {
      id: backendSlot.appointment.id,
      clinicId: '',
      doctorId: '',
      patientId: backendSlot.appointment.patient.id,
      startsAt: backendSlot.startsAt,
      endsAt: backendSlot.endsAt,
      reason: backendSlot.appointment.reason,
      status: backendSlot.appointment.status || 'BOOKED',
      createdAt: '',
      updatedAt: '',
      patient: backendSlot.appointment.patient,
      doctor: { id: '', fullName: '' },
    };
  }

  return slot;
}
