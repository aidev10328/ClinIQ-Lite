'use client';

import { useState, useMemo, useCallback } from 'react';

type WeeklySchedule = {
  dayOfWeek: number;
  shifts: {
    MORNING: boolean;
    AFTERNOON: boolean;
  };
};

type TimeOff = {
  id: string;
  startDate: string;
  endDate: string;
  type?: string;
  reason?: string | null;
};

type ShiftTemplate = {
  MORNING?: { start: string; end: string } | null;
  AFTERNOON?: { start: string; end: string } | null;
};

type CalendarPickerProps = {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  weekly?: WeeklySchedule[];
  timeOff?: TimeOff[];
  shiftTemplate?: ShiftTemplate;
  clinicToday?: Date; // The current date in clinic timezone
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function CalendarPicker({
  selectedDate,
  onSelectDate,
  weekly,
  timeOff,
  shiftTemplate,
  clinicToday,
}: CalendarPickerProps) {
  const [viewDate, setViewDate] = useState(() => new Date(selectedDate));

  // Parse date string as local date (avoids timezone issues)
  const parseLocalDate = useCallback((dateStr: string): Date => {
    // Handle ISO date strings like "2025-02-16" or "2025-02-16T00:00:00.000Z"
    const parts = dateStr.split('T')[0].split('-');
    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  }, []);

  // Check if a date is within any time-off period
  const isDateInTimeOff = useCallback((date: Date): boolean => {
    if (!timeOff || timeOff.length === 0) return false;

    // Compare only year, month, day (ignore time)
    const dateYear = date.getFullYear();
    const dateMonth = date.getMonth();
    const dateDay = date.getDate();

    return timeOff.some(to => {
      const start = parseLocalDate(to.startDate);
      const end = parseLocalDate(to.endDate);

      // Check if date falls within the range (inclusive)
      const dateValue = dateYear * 10000 + dateMonth * 100 + dateDay;
      const startValue = start.getFullYear() * 10000 + start.getMonth() * 100 + start.getDate();
      const endValue = end.getFullYear() * 10000 + end.getMonth() * 100 + end.getDate();

      return dateValue >= startValue && dateValue <= endValue;
    });
  }, [timeOff, parseLocalDate]);

  // Check if a date is a non-working day based on weekly schedule
  const isNonWorkingDay = useCallback((date: Date): boolean => {
    if (!weekly || !shiftTemplate) return false;

    const dayOfWeek = date.getDay();
    const daySchedule = weekly.find(w => w.dayOfWeek === dayOfWeek);

    if (!daySchedule) return true; // No schedule for this day

    // Check if any shift is enabled AND has a template defined
    const hasWorkingShift =
      (daySchedule.shifts.MORNING && shiftTemplate.MORNING) ||
      (daySchedule.shifts.AFTERNOON && shiftTemplate.AFTERNOON);

    return !hasWorkingShift;
  }, [weekly, shiftTemplate]);

  // Check if a date should be disabled (non-working or time-off)
  const isDateDisabled = useCallback((date: Date): boolean => {
    return isNonWorkingDay(date) || isDateInTimeOff(date);
  }, [isNonWorkingDay, isDateInTimeOff]);

  const calendarDays = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    // First day of month
    const firstDay = new Date(year, month, 1);
    const startingDayOfWeek = firstDay.getDay();

    // Last day of month
    const lastDay = new Date(year, month + 1, 0);
    const totalDays = lastDay.getDate();

    const days: (Date | null)[] = [];

    // Add empty slots for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Add all days of the month
    for (let day = 1; day <= totalDays; day++) {
      days.push(new Date(year, month, day));
    }

    return days;
  }, [viewDate]);

  const goToPrevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    // Use clinic today if provided, otherwise fall back to browser date
    const today = clinicToday || new Date();
    setViewDate(today);
    onSelectDate(today);
  };

  const isSelected = (date: Date | null) => {
    if (!date) return false;
    return (
      date.getDate() === selectedDate.getDate() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getFullYear() === selectedDate.getFullYear()
    );
  };

  const isToday = (date: Date | null) => {
    if (!date) return false;
    // Use clinic today if provided, otherwise fall back to browser date
    const today = clinicToday || new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={goToPrevMonth}
          className="p-1 rounded hover:bg-gray-100"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="text-sm font-medium text-gray-900">
          {MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}
        </div>
        <button
          onClick={goToNextMonth}
          className="p-1 rounded hover:bg-gray-100"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAYS.map((day) => (
          <div
            key={day}
            className="text-center text-xs font-medium text-gray-500 py-1"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((date, index) => {
          const disabled = date ? isDateDisabled(date) : false;
          const inTimeOff = date ? isDateInTimeOff(date) : false;

          return (
            <button
              key={index}
              onClick={() => date && !disabled && onSelectDate(date)}
              disabled={!date || disabled}
              className={`
                aspect-square flex items-center justify-center text-sm rounded relative
                ${!date ? 'invisible' : ''}
                ${disabled
                  ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                  : isSelected(date)
                    ? 'bg-primary-600 text-white font-medium'
                    : isToday(date)
                      ? 'bg-primary-100 text-primary-700 font-medium'
                      : 'hover:bg-gray-100 text-gray-700'
                }
              `}
              title={
                inTimeOff
                  ? 'Time off'
                  : disabled
                    ? 'Non-working day'
                    : undefined
              }
            >
              {date?.getDate()}
              {inTimeOff && date && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-red-400"></span>
              )}
            </button>
          );
        })}
      </div>

      {/* Today button */}
      <button
        onClick={goToToday}
        className="w-full mt-3 py-1.5 text-xs text-primary-600 hover:bg-primary-50 rounded transition-colors"
      >
        Go to Today
      </button>
    </div>
  );
}
