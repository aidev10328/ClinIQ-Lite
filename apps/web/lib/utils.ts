/**
 * Shared utility functions for the frontend
 */

// ============================================
// Date/Time Formatting
// ============================================

/**
 * Format time string (HH:MM) to 12-hour format
 */
export function formatTime(time: string): string {
  const [h, m] = time.split(':');
  const hour = parseInt(h);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${hour12}:${m} ${suffix}`;
}

/**
 * Format time range from two HH:MM strings
 */
export function formatTimeRange(start: string, end: string): string {
  return `${formatTime(start)} - ${formatTime(end)}`;
}

/**
 * Parse date string (YYYY-MM-DD) as local date to avoid timezone issues
 */
export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Format date string for display in local timezone
 */
export function formatDateLocal(dateStr: string, options: Intl.DateTimeFormatOptions): string {
  return parseLocalDate(dateStr).toLocaleDateString('en-US', options);
}

/**
 * Format a Date object for display
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
 */
export function formatDateForApi(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get today's date as YYYY-MM-DD string
 */
export function getTodayString(): string {
  return formatDateForApi(new Date());
}

/**
 * Check if two dates are the same day
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * Check if a date is today
 */
export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

// ============================================
// Time Options (for dropdowns)
// ============================================

/**
 * Generate time options for dropdowns (30-minute intervals)
 */
export function generateTimeOptions(): { value: string; label: string }[] {
  return Array.from({ length: 48 }, (_, i) => {
    const hour = Math.floor(i / 2);
    const min = i % 2 === 0 ? '00' : '30';
    const h = hour.toString().padStart(2, '0');
    const value = `${h}:${min}`;
    return { value, label: formatTime(value) };
  });
}

// Pre-generated for performance
export const TIME_OPTIONS = generateTimeOptions();

/**
 * Duration options for appointment slots
 */
export const DURATION_OPTIONS = [
  { value: 10, label: '10 min' },
  { value: 20, label: '20 min' },
  { value: 30, label: '30 min' },
  { value: 40, label: '40 min' },
  { value: 50, label: '50 min' },
  { value: 60, label: '60 min' },
];

/**
 * Day names starting with Sunday
 */
export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Full day names
 */
export const DAY_NAMES_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ============================================
// Shift Constants
// ============================================

export type ShiftType = 'MORNING' | 'AFTERNOON';

export const SHIFT_TYPES: ShiftType[] = ['MORNING', 'AFTERNOON'];

export const SHIFT_LABELS: Record<ShiftType, string> = {
  MORNING: 'Morning',
  AFTERNOON: 'Afternoon',
};

export const SHIFT_ICONS: Record<ShiftType, string> = {
  MORNING: '🌅',
  AFTERNOON: '☀️',
};

// ============================================
// Validation Helpers
// ============================================

/**
 * Validate phone number format
 */
export function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  // Extract last 10 digits if there's a country code
  const normalized = digits.length > 10 ? digits.slice(-10) : digits;
  return normalized.length === 10;
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Format phone number for display (e.g., +1 (555) 123-4567)
 */
export function formatPhoneDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length > 10) {
    const countryCode = digits.slice(0, digits.length - 10);
    const number = digits.slice(-10);
    return `+${countryCode} (${number.slice(0, 3)}) ${number.slice(3, 6)}-${number.slice(6)}`;
  }
  return phone;
}

// ============================================
// String Helpers
// ============================================

/**
 * Compute full name from first and last name
 */
export function computeFullName(firstName: string, lastName: string): string {
  return lastName ? `${firstName} ${lastName}`.trim() : firstName.trim();
}

/**
 * Get initials from a full name
 */
export function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return fullName.substring(0, 2).toUpperCase();
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}
