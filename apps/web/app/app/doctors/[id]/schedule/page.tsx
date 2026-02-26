'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getDoctorScheduleData,
  updateDoctorSchedule,
  createTimeOff,
  deleteTimeOff,
  DoctorScheduleData,
  UpdateSchedulePayload,
  ShiftType,
  TimeOffType,
  TimeOffEntry,
  getClinicTime,
} from '../../../../../lib/api';

// Time options for dropdowns
const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 2);
  const min = i % 2 === 0 ? '00' : '30';
  const h = hour.toString().padStart(2, '0');
  return { value: `${h}:${min}`, label: formatTime(`${h}:${min}`) };
});

const DURATION_OPTIONS = [
  { value: 15, label: '15 min' },
  { value: 20, label: '20 min' },
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '60 min' },
];

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SHIFT_TYPES: ShiftType[] = ['MORNING', 'EVENING'];
const SHIFT_LABELS: Record<ShiftType, string> = {
  MORNING: 'Morning',
  EVENING: 'Evening',
};
const SHIFT_ICONS: Record<ShiftType, string> = {
  MORNING: '🌅',
  EVENING: '🌆',
};

function formatTime(time: string): string {
  const [h, m] = time.split(':');
  const hour = parseInt(h);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${hour12}:${m} ${suffix}`;
}

function formatTimeRange(start: string, end: string): string {
  return `${formatTime(start)} - ${formatTime(end)}`;
}

export default function DoctorSchedulePage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const doctorId = params.id as string;

  // Local state for form
  const [activeTab, setActiveTab] = useState<'personal' | 'professional' | 'schedule'>('schedule');
  const [appointmentDuration, setAppointmentDuration] = useState(15);
  const [shiftTemplates, setShiftTemplates] = useState<Record<ShiftType, { start: string; end: string }>>({
    MORNING: { start: '09:00', end: '13:00' },
    EVENING: { start: '14:00', end: '18:00' },
  });
  const [weeklyShifts, setWeeklyShifts] = useState<Record<number, Record<ShiftType, boolean>>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Time off modal state
  const [showTimeOffModal, setShowTimeOffModal] = useState(false);
  const [timeOffForm, setTimeOffForm] = useState({
    startDate: '',
    endDate: '',
    type: 'BREAK' as TimeOffType,
    reason: '',
  });

  // Calendar state
  const [calendarDate, setCalendarDate] = useState(new Date());

  // Fetch clinic time (for timezone-aware "today" highlighting)
  const { data: clinicTime } = useQuery({
    queryKey: ['clinicTime'],
    queryFn: async () => {
      const { data, error } = await getClinicTime();
      if (error) throw new Error(error.message);
      return data;
    },
    staleTime: 60 * 1000, // 1 minute
  });

  // Fetch schedule data
  const { data: scheduleData, isLoading, error } = useQuery({
    queryKey: ['doctorSchedule', doctorId],
    queryFn: async () => {
      const { data, error } = await getDoctorScheduleData(doctorId);
      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!doctorId,
  });

  // Initialize form state from fetched data
  useEffect(() => {
    if (scheduleData) {
      setAppointmentDuration(scheduleData.doctor.appointmentDurationMin);

      // Set shift templates
      const templates: Record<ShiftType, { start: string; end: string }> = {
        MORNING: scheduleData.shiftTemplate.MORNING || { start: '09:00', end: '13:00' },
        EVENING: scheduleData.shiftTemplate.EVENING || { start: '14:00', end: '18:00' },
      };
      setShiftTemplates(templates);

      // Set weekly shifts
      const weekly: Record<number, Record<ShiftType, boolean>> = {};
      for (let day = 0; day <= 6; day++) {
        const dayData = scheduleData.weekly.find((w) => w.dayOfWeek === day);
        weekly[day] = dayData?.shifts || { MORNING: false, EVENING: false };
      }
      setWeeklyShifts(weekly);
    }
  }, [scheduleData]);

  // Save schedule mutation
  const saveMutation = useMutation({
    mutationFn: async (payload: UpdateSchedulePayload) => {
      const { data, error } = await updateDoctorSchedule(doctorId, payload);
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      setSaveMessage({ type: 'success', text: 'Schedule saved successfully!' });
      queryClient.invalidateQueries({ queryKey: ['doctorSchedule', doctorId] });
      setTimeout(() => setSaveMessage(null), 3000);
    },
    onError: (err) => {
      setSaveMessage({ type: 'error', text: err.message });
    },
  });

  // Create time off mutation
  const createTimeOffMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await createTimeOff(doctorId, {
        startDate: timeOffForm.startDate,
        endDate: timeOffForm.endDate,
        type: timeOffForm.type,
        reason: timeOffForm.reason || undefined,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      setShowTimeOffModal(false);
      setTimeOffForm({ startDate: '', endDate: '', type: 'BREAK', reason: '' });
      queryClient.invalidateQueries({ queryKey: ['doctorSchedule', doctorId] });
    },
  });

  // Delete time off mutation
  const deleteTimeOffMutation = useMutation({
    mutationFn: async (timeOffId: string) => {
      const { error } = await deleteTimeOff(doctorId, timeOffId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctorSchedule', doctorId] });
    },
  });

  const handleSave = () => {
    const payload: UpdateSchedulePayload = {
      appointmentDurationMin: appointmentDuration,
      shiftTemplate: {
        MORNING: shiftTemplates.MORNING,
        EVENING: shiftTemplates.EVENING,
      },
      weekly: Object.entries(weeklyShifts).map(([day, shifts]) => ({
        dayOfWeek: parseInt(day),
        shifts,
      })),
    };
    saveMutation.mutate(payload);
  };

  const handleShiftTemplateChange = (shift: ShiftType, field: 'start' | 'end', value: string) => {
    setShiftTemplates((prev) => ({
      ...prev,
      [shift]: { ...prev[shift], [field]: value },
    }));
  };

  const handleWeeklyShiftToggle = (day: number, shift: ShiftType) => {
    setWeeklyShifts((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [shift]: !prev[day]?.[shift],
      },
    }));
  };

  // Calendar helpers
  const calendarDays = useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const startingDayOfWeek = firstDay.getDay();
    const lastDay = new Date(year, month + 1, 0);
    const totalDays = lastDay.getDate();

    const days: (Date | null)[] = [];
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    for (let day = 1; day <= totalDays; day++) {
      days.push(new Date(year, month, day));
    }
    return days;
  }, [calendarDate]);

  const isTimeOffDay = (date: Date | null): boolean => {
    if (!date || !scheduleData?.timeOff) return false;
    const dateStr = date.toISOString().split('T')[0];
    return scheduleData.timeOff.some((t) => {
      return dateStr >= t.startDate && dateStr <= t.endDate;
    });
  };

  const handleDeleteTimeOff = (id: string) => {
    if (window.confirm('Remove this time off entry?')) {
      deleteTimeOffMutation.mutate(id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading schedule...</div>
      </div>
    );
  }

  if (error || !scheduleData) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-red-500">Failed to load schedule</div>
      </div>
    );
  }

  const { doctor, timeOff } = scheduleData;

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header Card */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
            <span className="text-2xl font-semibold text-primary-700">
              {doctor.fullName.charAt(0)}
            </span>
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-semibold text-gray-900">{doctor.fullName}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="px-2 py-0.5 bg-teal-50 text-teal-700 text-xs font-medium rounded">
                {doctor.specialization}
              </span>
            </div>
          </div>
          <button
            onClick={() => router.back()}
            className="btn-secondary text-sm"
          >
            Back
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg border border-gray-200 mb-4">
        <div className="flex border-b border-gray-200">
          {(['personal', 'professional', 'schedule'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === tab
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'schedule' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left Column - Shift Timings & Weekly Schedule */}
          <div className="lg:col-span-2 space-y-4">
            {/* Shift Timings Section */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Shift Timings</h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                {SHIFT_TYPES.map((shift) => (
                  <div
                    key={shift}
                    className="bg-gray-50 rounded-lg p-3 border border-gray-200"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-lg">{SHIFT_ICONS[shift]}</span>
                      <span className="font-medium text-gray-900">{SHIFT_LABELS[shift]}</span>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Start Time</label>
                        <select
                          value={shiftTemplates[shift].start}
                          onChange={(e) => handleShiftTemplateChange(shift, 'start', e.target.value)}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        >
                          {TIME_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">End Time</label>
                        <select
                          value={shiftTemplates[shift].end}
                          onChange={(e) => handleShiftTemplateChange(shift, 'end', e.target.value)}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        >
                          {TIME_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Appointment Duration */}
              <div className="flex items-center gap-4 pt-4 border-t border-gray-200">
                <label className="text-sm text-gray-700">Appointment Duration:</label>
                <select
                  value={appointmentDuration}
                  onChange={(e) => setAppointmentDuration(parseInt(e.target.value))}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  {DURATION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <div className="flex-1"></div>
                <button
                  onClick={handleSave}
                  disabled={saveMutation.isPending}
                  className="btn-primary text-sm"
                >
                  {saveMutation.isPending ? 'Saving...' : 'Save Schedule'}
                </button>
              </div>

              {/* Save message */}
              {saveMessage && (
                <div
                  className={`mt-3 px-3 py-2 rounded text-sm ${
                    saveMessage.type === 'success'
                      ? 'bg-green-50 text-green-700'
                      : 'bg-red-50 text-red-700'
                  }`}
                >
                  {saveMessage.text}
                </div>
              )}
            </div>

            {/* Weekly Schedule Section */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Weekly Schedule</h2>

              <div className="space-y-2">
                {DAY_NAMES.map((dayName, dayIndex) => {
                  const dayShifts = weeklyShifts[dayIndex] || { MORNING: false, EVENING: false };
                  const hasAnyShift = dayShifts.MORNING || dayShifts.EVENING;

                  return (
                    <div
                      key={dayIndex}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                        hasAnyShift
                          ? 'bg-green-50/50 border-green-200'
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="w-24 font-medium text-gray-900 text-sm">{dayName}</div>

                      {/* Shift tags showing enabled times */}
                      <div className="flex-1 flex flex-wrap gap-2">
                        {SHIFT_TYPES.map((shift) => {
                          const isEnabled = dayShifts[shift];
                          const template = shiftTemplates[shift];

                          return (
                            <button
                              key={shift}
                              onClick={() => handleWeeklyShiftToggle(dayIndex, shift)}
                              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                                isEnabled
                                  ? 'bg-primary-100 text-primary-700 border border-primary-200'
                                  : 'bg-gray-100 text-gray-400 border border-gray-200 hover:bg-gray-200'
                              }`}
                            >
                              {isEnabled
                                ? formatTimeRange(template.start, template.end)
                                : SHIFT_LABELS[shift]}
                            </button>
                          );
                        })}
                      </div>

                      {/* Toggle switches */}
                      <div className="flex items-center gap-2">
                        {SHIFT_TYPES.map((shift) => (
                          <label key={shift} className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={dayShifts[shift]}
                              onChange={() => handleWeeklyShiftToggle(dayIndex, shift)}
                              className="sr-only peer"
                            />
                            <div className="w-8 h-4 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-primary-600"></div>
                            <span className="ms-1 text-xs text-gray-500">{SHIFT_ICONS[shift]}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column - Calendar & Time Off */}
          <div className="space-y-4">
            {/* Calendar */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1))}
                  className="p-1 rounded hover:bg-gray-100"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div className="text-sm font-medium text-gray-900">
                  {calendarDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                </div>
                <button
                  onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1))}
                  className="p-1 rounded hover:bg-gray-100"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 gap-1 mb-1">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                  <div key={i} className="text-center text-xs font-medium text-gray-500 py-1">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((date, index) => {
                  const isOff = isTimeOffDay(date);
                  // Use clinic timezone for "today" highlight, not browser local time
                  const dateStr = date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` : '';
                  const isToday = dateStr === clinicTime?.currentDate;

                  return (
                    <div
                      key={index}
                      className={`aspect-square flex items-center justify-center text-xs rounded ${
                        !date
                          ? ''
                          : isOff
                            ? 'bg-red-100 text-red-700 font-medium'
                            : isToday
                              ? 'bg-primary-100 text-primary-700 font-medium'
                              : 'text-gray-700'
                      }`}
                    >
                      {date?.getDate()}
                    </div>
                  );
                })}
              </div>

              <button
                onClick={() => setShowTimeOffModal(true)}
                className="w-full mt-4 btn-secondary text-sm"
              >
                + Time Off
              </button>
            </div>

            {/* Scheduled Time Off */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Scheduled Time Off</h3>

              {timeOff.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No time off scheduled</p>
              ) : (
                <div className="space-y-2">
                  {timeOff.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center gap-2 p-2 bg-gray-50 rounded border border-gray-200"
                    >
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900">
                          {entry.startDate === entry.endDate
                            ? new Date(entry.startDate).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                              })
                            : `${new Date(entry.startDate).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                              })} - ${new Date(entry.endDate).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                              })}`}
                        </div>
                        <div className="text-xs text-gray-500">
                          {entry.type}{entry.reason ? ` - ${entry.reason}` : ''}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteTimeOff(entry.id)}
                        disabled={deleteTimeOffMutation.isPending}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab !== 'schedule' && (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <p className="text-gray-500">
            {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} information coming soon.
          </p>
        </div>
      )}

      {/* Time Off Modal */}
      {showTimeOffModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Add Time Off</h3>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={timeOffForm.startDate}
                  onChange={(e) => setTimeOffForm({ ...timeOffForm, startDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input
                  type="date"
                  value={timeOffForm.endDate}
                  onChange={(e) => setTimeOffForm({ ...timeOffForm, endDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={timeOffForm.type}
                  onChange={(e) => setTimeOffForm({ ...timeOffForm, type: e.target.value as TimeOffType })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="BREAK">Break</option>
                  <option value="VACATION">Vacation</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason (optional)</label>
                <input
                  type="text"
                  value={timeOffForm.reason}
                  onChange={(e) => setTimeOffForm({ ...timeOffForm, reason: e.target.value })}
                  placeholder="e.g., Doctor's appointment"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
              <button
                onClick={() => setShowTimeOffModal(false)}
                className="btn-secondary text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => createTimeOffMutation.mutate()}
                disabled={!timeOffForm.startDate || !timeOffForm.endDate || createTimeOffMutation.isPending}
                className="btn-primary text-sm"
              >
                {createTimeOffMutation.isPending ? 'Adding...' : 'Add Time Off'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
