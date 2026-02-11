import { Injectable } from '@nestjs/common';

/**
 * Timezone utility service for handling clinic-specific timezone operations.
 * All dates/times in the system should be stored and processed relative to the clinic's timezone.
 */
@Injectable()
export class TimezoneService {
  /**
   * Get the current date in the clinic's timezone (date only, no time)
   * Returns a Date object representing midnight of today in the clinic timezone.
   */
  getClinicDate(timezone: string): Date {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-CA', { timeZone: timezone }); // YYYY-MM-DD format
    // Use parseDateInTimezone for consistent handling
    return this.parseDateInTimezone(dateStr, timezone);
  }

  /**
   * Get today's date in the clinic's timezone as a UTC midnight Date.
   * Use this for @db.Date fields which store only the date portion at UTC midnight.
   * This ensures consistent storage and querying.
   */
  getClinicDateUtcMidnight(timezone: string): Date {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-CA', { timeZone: timezone }); // YYYY-MM-DD format
    return new Date(dateStr + 'T00:00:00.000Z'); // UTC midnight
  }

  /**
   * Convert a date string (YYYY-MM-DD) to UTC midnight Date.
   * Use this for @db.Date fields which store only the date portion at UTC midnight.
   */
  toUtcMidnight(dateStr: string): Date {
    return new Date(dateStr + 'T00:00:00.000Z');
  }

  /**
   * Get the current datetime in the clinic's timezone
   */
  getClinicNow(timezone: string): Date {
    const now = new Date();
    return this.convertToTimezone(now, timezone);
  }

  /**
   * Convert a UTC date to clinic timezone
   */
  convertToTimezone(date: Date, timezone: string): Date {
    const options: Intl.DateTimeFormatOptions = {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    };

    const formatter = new Intl.DateTimeFormat('en-CA', options);
    const parts = formatter.formatToParts(date);

    const getPart = (type: string) => {
      const part = parts.find(p => p.type === type);
      return part ? parseInt(part.value, 10) : 0;
    };

    return new Date(
      getPart('year'),
      getPart('month') - 1,
      getPart('day'),
      getPart('hour'),
      getPart('minute'),
      getPart('second'),
    );
  }

  /**
   * Create a date object for a specific date and time in the clinic's timezone.
   * This is useful when creating slots - the time (e.g., 9:00 AM) is in clinic time.
   *
   * @param dateStr - Date string in YYYY-MM-DD format
   * @param timeStr - Time string in HH:MM format (24-hour)
   * @param timezone - IANA timezone (e.g., "Asia/Kolkata")
   * @returns Date object representing this time in UTC
   */
  createDateInTimezone(dateStr: string, timeStr: string, timezone: string): Date {
    const [year, month, day] = dateStr.split('-').map(Number);
    const [hours, minutes] = timeStr.split(':').map(Number);

    // Create a date representing this time AS IF it were UTC
    const asIfUtc = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0));

    // See what this UTC time looks like when displayed in the target timezone
    const inTargetTz = asIfUtc.toLocaleString('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    });

    // Parse it back (creates a date in server's local time)
    const parsedInTz = new Date(inTargetTz);

    // The time we actually wanted (as server local time for calculation)
    const wanted = new Date(year, month - 1, day, hours, minutes, 0);

    // The difference tells us the timezone offset adjustment needed
    const offsetMs = wanted.getTime() - parsedInTz.getTime();

    // Adjust the UTC time by this offset
    return new Date(asIfUtc.getTime() + offsetMs);
  }

  /**
   * Parse a date-only string (YYYY-MM-DD) as a local date in the clinic timezone.
   * Returns a Date object set to midnight in the clinic timezone.
   */
  parseDateInTimezone(dateStr: string, timezone: string): Date {
    return this.createDateInTimezone(dateStr, '00:00', timezone);
  }

  /**
   * Format a date as YYYY-MM-DD in the clinic's timezone
   */
  formatDateInTimezone(date: Date, timezone: string): string {
    return date.toLocaleDateString('en-CA', { timeZone: timezone });
  }

  /**
   * Format a date as HH:MM in the clinic's timezone
   */
  formatTimeInTimezone(date: Date, timezone: string): string {
    return date.toLocaleTimeString('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }

  /**
   * Get start of day in clinic timezone
   */
  getStartOfDayInTimezone(date: Date, timezone: string): Date {
    const dateStr = this.formatDateInTimezone(date, timezone);
    return this.createDateInTimezone(dateStr, '00:00', timezone);
  }

  /**
   * Get end of day in clinic timezone (23:59:59.999)
   */
  getEndOfDayInTimezone(date: Date, timezone: string): Date {
    const dateStr = this.formatDateInTimezone(date, timezone);
    const endOfDay = this.createDateInTimezone(dateStr, '23:59', timezone);
    endOfDay.setSeconds(59);
    endOfDay.setMilliseconds(999);
    return endOfDay;
  }

  /**
   * Check if two dates are the same day in the clinic timezone
   */
  isSameDayInTimezone(date1: Date, date2: Date, timezone: string): boolean {
    return (
      this.formatDateInTimezone(date1, timezone) ===
      this.formatDateInTimezone(date2, timezone)
    );
  }

  /**
   * Get the day of week (0=Sunday, 6=Saturday) for a date in clinic timezone
   */
  getDayOfWeekInTimezone(date: Date, timezone: string): number {
    const converted = this.convertToTimezone(date, timezone);
    return converted.getDay();
  }

  /**
   * Add days to a date while preserving the clinic timezone
   */
  addDaysInTimezone(date: Date, days: number, timezone: string): Date {
    const dateStr = this.formatDateInTimezone(date, timezone);
    const timeStr = this.formatTimeInTimezone(date, timezone);

    const [year, month, day] = dateStr.split('-').map(Number);
    const newDate = new Date(year, month - 1, day + days);
    const newDateStr = `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}-${String(newDate.getDate()).padStart(2, '0')}`;

    return this.createDateInTimezone(newDateStr, timeStr, timezone);
  }

  /**
   * Get an array of dates between start and end (inclusive) in clinic timezone
   */
  getDateRangeInTimezone(startDate: Date, endDate: Date, timezone: string): Date[] {
    const dates: Date[] = [];
    let current = this.getStartOfDayInTimezone(startDate, timezone);
    const end = this.getStartOfDayInTimezone(endDate, timezone);

    while (current <= end) {
      dates.push(new Date(current));
      current = this.addDaysInTimezone(current, 1, timezone);
    }

    return dates;
  }
}
