'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../../components/AuthProvider';
import DoctorSelector from '../../../components/appointments/DoctorSelector';
import CalendarPicker from '../../../components/appointments/CalendarPicker';
import SlotColumn from '../../../components/appointments/SlotColumn';
import BookAppointmentModal from '../../../components/appointments/BookAppointmentModal';
import { useClinicTime } from '../../../lib/hooks/useQueueData';
import {
  listDoctors,
  getMyAssignedDoctors,
  cancelAppointment,
  rescheduleAppointment,
  generateDoctorSlots,
  getDoctorScheduleData,
  Doctor,
  DoctorScheduleData,
} from '../../../lib/api';
import {
  Slot,
  SlotsByPeriod,
  groupSlotsByPeriod,
  countSlots,
  formatDateDisplay,
  formatDateForApi,
  convertBackendSlotToFrontend,
  markPastSlots,
} from '../../../lib/slots';

export default function AppointmentsPage() {
  const { clinicId, isManager, clinicRole, doctorId: authDoctorId } = useAuth();

  // Check if user is doctor-only (not manager/staff)
  const isDoctorOnly = clinicRole === 'CLINIC_DOCTOR' && !isManager;

  // Doctors can only view appointments, not book/cancel/reschedule
  const readOnlyMode = isDoctorOnly;

  // Get clinic time (current date in clinic timezone)
  const { data: clinicTime, isLoading: clinicTimeLoading } = useClinicTime();
  const clinicTimezone = clinicTime?.timezone || 'UTC';

  // Parse clinic's current date for calendar "today" highlighting
  const clinicToday = useMemo(() => {
    if (!clinicTime?.currentDate) return undefined;
    const parts = clinicTime.currentDate.split('-');
    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  }, [clinicTime?.currentDate]);

  // Data state
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [scheduleData, setScheduleData] = useState<DoctorScheduleData | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dateInitialized, setDateInitialized] = useState(false);

  // Initialize selected date from clinic time (not browser time)
  useEffect(() => {
    if (clinicTime?.currentDate && !dateInitialized) {
      // Parse YYYY-MM-DD string as local date
      const parts = clinicTime.currentDate.split('-');
      const clinicDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      setSelectedDate(clinicDate);
      setDateInitialized(true);
    }
  }, [clinicTime?.currentDate, dateInitialized]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Slots
  const [slotsByPeriod, setSlotsByPeriod] = useState<SlotsByPeriod>({
    morning: [],
    evening: [],
  });
  const [totalSlots, setTotalSlots] = useState({ open: 0, booked: 0 });

  // Modal state
  const [bookingSlot, setBookingSlot] = useState<Slot | null>(null);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);

  // Load doctors (only licensed doctors can accept appointments)
  // Staff can only see their assigned doctors
  const isStaff = clinicRole === 'CLINIC_STAFF';

  useEffect(() => {
    if (!clinicId) return;

    async function loadDoctorsData() {
      setLoading(true);
      try {
        // For staff, load both lists in parallel for faster loading
        if (isStaff) {
          const [doctorsResult, assignedResult] = await Promise.all([
            listDoctors({ licensedOnly: true }),
            getMyAssignedDoctors(),
          ]);

          if (doctorsResult.error) {
            setError(doctorsResult.error.message);
            setLoading(false);
            return;
          }

          const allDoctors = doctorsResult.data || [];
          const assignedDoctors = assignedResult.data || [];

          let filteredDoctors: Doctor[] = [];
          if (assignedDoctors.length > 0) {
            const assignedIds = new Set(assignedDoctors.map(d => d.id));
            filteredDoctors = allDoctors.filter(d => assignedIds.has(d.id));
          }

          if (filteredDoctors.length > 0) {
            setDoctors(filteredDoctors);
            setSelectedDoctorId(filteredDoctors[0].id);
            // Set selected doctor directly from list to avoid extra API call
            setSelectedDoctor(filteredDoctors[0]);
          } else {
            setDoctors([]);
            setSelectedDoctorId(null);
          }
          setLoading(false);
          return;
        }

        // For non-staff users
        const { data, error } = await listDoctors({ licensedOnly: true });
        if (error) {
          setError(error.message);
          setLoading(false);
          return;
        }

        let filteredDoctors = data || [];

        // For doctors, filter to only their own doctor record
        if (isDoctorOnly && authDoctorId) {
          filteredDoctors = filteredDoctors.filter(d => d.id === authDoctorId);
        }

        if (filteredDoctors.length > 0) {
          setDoctors(filteredDoctors);
          setSelectedDoctorId(filteredDoctors[0].id);
          // Set selected doctor directly from list to avoid extra API call
          setSelectedDoctor(filteredDoctors[0]);
        } else {
          setDoctors([]);
          setSelectedDoctorId(null);
        }
      } catch (err) {
        setError('Failed to load doctors');
      }
      setLoading(false);
    }

    loadDoctorsData();
  }, [clinicId, isStaff, isDoctorOnly, authDoctorId]);

  // Load doctor schedule data when selection changes
  // Note: selectedDoctor is set directly from doctors list to avoid extra API call
  useEffect(() => {
    if (!selectedDoctorId) {
      setSelectedDoctor(null);
      setScheduleData(null);
      return;
    }

    // Update selected doctor from doctors list (no API call needed)
    const doctorFromList = doctors.find(d => d.id === selectedDoctorId);
    if (doctorFromList) {
      setSelectedDoctor(doctorFromList);
    }

    // Only fetch schedule data (the only thing not in the list)
    async function loadScheduleData() {
      const scheduleResult = await getDoctorScheduleData(selectedDoctorId!);
      if (scheduleResult.data) {
        setScheduleData(scheduleResult.data);
      }
    }

    loadScheduleData();
  }, [selectedDoctorId, doctors]);

  // Load slots when doctor or date changes
  // Appointment data is now included directly in slot response from backend
  const loadSlots = useCallback(async () => {
    if (!selectedDoctorId || !selectedDate) {
      setSlotsByPeriod({ morning: [], evening: [] });
      setTotalSlots({ open: 0, booked: 0 });
      return;
    }

    setSlotsLoading(true);

    const dateStr = formatDateForApi(selectedDate);
    const slotsResult = await generateDoctorSlots(selectedDoctorId, dateStr);

    if (slotsResult.error || !slotsResult.data) {
      setSlotsLoading(false);
      setSlotsByPeriod({ morning: [], evening: [] });
      setTotalSlots({ open: 0, booked: 0 });
      return;
    }

    // Convert backend slots to frontend format (appointment data is already included)
    let slots: Slot[] = slotsResult.data.slots.map(bs => convertBackendSlotToFrontend(bs, selectedDate));

    // Mark past slots (use server time for accurate comparison)
    if (clinicTime?.serverTime) {
      const clinicNow = new Date(clinicTime.serverTime);
      slots = markPastSlots(slots, clinicNow);
    }

    const grouped = groupSlotsByPeriod(slots);

    setSlotsByPeriod(grouped);
    setTotalSlots(countSlots(slots));
    setSlotsLoading(false);
  }, [selectedDoctorId, selectedDate, clinicTime?.serverTime]);

  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  // Parse date string as local date (avoids timezone issues)
  const parseLocalDate = useCallback((dateStr: string): Date => {
    const parts = dateStr.split('T')[0].split('-');
    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  }, []);

  // Get upcoming day-offs (next 30 days)
  const upcomingDayOffs = useMemo(() => {
    if (!scheduleData?.timeOff) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return scheduleData.timeOff
      .filter(to => {
        const endDate = parseLocalDate(to.endDate);
        return endDate >= today;
      })
      .slice(0, 3); // Show max 3
  }, [scheduleData?.timeOff, parseLocalDate]);

  const handleOpenBooking = (slot: Slot) => {
    setBookingSlot(slot);
    setIsBookingModalOpen(true);
  };

  const handleBookingSuccess = () => {
    loadSlots();
  };

  const handleCancel = async (slot: Slot) => {
    if (!slot.appointment) return;
    const confirmed = window.confirm(`Cancel appointment for ${slot.appointment.patient.fullName}?`);
    if (!confirmed) return;

    const { error } = await cancelAppointment(slot.appointment.id);
    if (error) {
      alert(error.message);
    } else {
      loadSlots();
    }
  };

  const handleReschedule = async (slot: Slot) => {
    if (!slot.appointment) return;

    const confirmed = window.confirm(
      `Reschedule appointment for ${slot.appointment.patient.fullName}?\n\n` +
      `This will mark the current appointment as "Rescheduled" and free up the slot.\n` +
      `You can then book a new appointment for the patient.`
    );
    if (!confirmed) return;

    const { error } = await rescheduleAppointment(slot.appointment.id);
    if (error) {
      alert(error.message);
    } else {
      loadSlots();
    }
  };

  if (loading || clinicTimeLoading || !selectedDate) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col overflow-hidden">
      {/* Compact Header */}
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <h1 className="text-lg font-semibold text-gray-900">Appointments</h1>
        <button
          onClick={loadSlots}
          className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
          disabled={slotsLoading}
        >
          <svg className={`w-3.5 h-3.5 ${slotsLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {slotsLoading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {error && <div className="alert-error mb-2 text-xs flex-shrink-0">{error}</div>}

      <div className="flex flex-col md:flex-row gap-2 flex-1 min-h-0 overflow-hidden">
        {/* Compact Left Panel */}
        <div className="md:w-56 lg:w-64 flex-shrink-0 space-y-2 overflow-y-auto">
          {/* Doctor selector */}
          <div className="bg-white rounded-lg border border-gray-200 px-2 py-1.5">
            <DoctorSelector
              doctors={doctors}
              selectedDoctorId={selectedDoctorId}
              onSelect={setSelectedDoctorId}
              loading={loading}
              showTitle={true}
            />
          </div>

          {/* Calendar */}
          <CalendarPicker
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            weekly={scheduleData?.weekly}
            timeOff={scheduleData?.timeOff}
            shiftTemplate={scheduleData?.shiftTemplate}
            clinicToday={clinicToday}
          />

          {/* Combined Doctor Info Panel */}
          {selectedDoctor && scheduleData && (
            <div className="bg-white rounded-lg border border-gray-200 p-2">
              {/* Duration */}
              <div className="flex items-center justify-between text-[10px] pb-1.5 border-b border-gray-100">
                <span className="text-gray-500">Duration</span>
                <span className="font-medium text-gray-900">{selectedDoctor.appointmentDurationMin} min</span>
              </div>

              {/* Shift Timings */}
              <div className="pt-1.5 pb-1.5 border-b border-gray-100 space-y-0.5">
                {scheduleData.shiftTemplate.MORNING && (
                  <div className="flex items-center justify-between text-[9px]">
                    <span className="text-amber-600">Morning</span>
                    <span className="text-gray-600">{scheduleData.shiftTemplate.MORNING.start} - {scheduleData.shiftTemplate.MORNING.end}</span>
                  </div>
                )}
                {scheduleData.shiftTemplate.EVENING && (
                  <div className="flex items-center justify-between text-[9px]">
                    <span className="text-blue-600">Evening</span>
                    <span className="text-gray-600">{scheduleData.shiftTemplate.EVENING.start} - {scheduleData.shiftTemplate.EVENING.end}</span>
                  </div>
                )}
              </div>

              {/* Weekly Schedule - Compact */}
              <div className="pt-1.5">
                <div className="text-[10px] text-gray-500 mb-1">Weekly Schedule</div>
                <div className="grid grid-cols-7 gap-0.5 text-[9px]">
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => {
                    const daySchedule = scheduleData.weekly.find(w => w.dayOfWeek === idx);
                    const hasShifts = daySchedule && (
                      (daySchedule.shifts.MORNING && scheduleData.shiftTemplate.MORNING) ||
                      (daySchedule.shifts.EVENING && scheduleData.shiftTemplate.EVENING)
                    );
                    return (
                      <div
                        key={idx}
                        className={`text-center py-0.5 rounded ${
                          hasShifts ? 'bg-green-100 text-green-700 font-medium' : 'bg-gray-100 text-gray-400'
                        }`}
                        title={hasShifts ? 'Working' : 'Off'}
                      >
                        {day}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Day-offs */}
              {upcomingDayOffs.length > 0 && (
                <div className="pt-1.5 mt-1.5 border-t border-gray-100">
                  <div className="text-[10px] text-gray-500 mb-1">Upcoming Time Off</div>
                  <div className="space-y-0.5">
                    {upcomingDayOffs.map((to) => {
                      const start = parseLocalDate(to.startDate);
                      const end = parseLocalDate(to.endDate);
                      const isSameDay = start.toDateString() === end.toDateString();
                      return (
                        <div key={to.id} className="text-[9px] text-red-600 bg-red-50 px-1 py-0.5 rounded">
                          {isSameDay
                            ? start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                            : `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                          }
                          {to.reason && <span className="text-red-500 ml-1">({to.reason})</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {/* Compact Day header */}
          <div className="bg-white rounded-lg border border-gray-200 px-3 py-1.5 mb-2 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-semibold text-gray-900">
                  {formatDateDisplay(selectedDate)}
                </span>
                {selectedDoctor && (
                  <span className="text-xs text-gray-500 ml-2">
                    {selectedDoctor.fullName}
                  </span>
                )}
              </div>
              <div className="flex gap-2 text-xs">
                <span className="text-gray-500 font-medium">{totalSlots.open + totalSlots.booked} slots</span>
                <span className="text-gray-300">|</span>
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                  <span className="text-gray-600">{totalSlots.open}</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary-500"></span>
                  <span className="text-gray-600">{totalSlots.booked}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Slot board */}
          <div className="flex-1 min-h-0 overflow-auto">
            {!selectedDoctor ? (
              <div className="bg-gray-50 rounded-lg border border-gray-200 p-8 text-center">
                <svg className="w-10 h-10 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <p className="text-sm text-gray-500">Select a doctor to view slots</p>
              </div>
            ) : slotsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 h-full animate-pulse">
                {[1, 2].map((i) => (
                  <div key={i} className="bg-gray-100 rounded-lg h-full min-h-[200px]"></div>
                ))}
              </div>
            ) : totalSlots.open === 0 && totalSlots.booked === 0 ? (
              <div className="bg-gray-50 rounded-lg border border-gray-200 p-8 text-center">
                <svg className="w-10 h-10 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-sm text-gray-500">No schedule for this day</p>
                <p className="text-[10px] text-gray-400 mt-1">
                  {selectedDate.toLocaleDateString('en-US', { weekday: 'long' })} is not a working day
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 h-full">
                <SlotColumn
                  period="morning"
                  slots={slotsByPeriod.morning}
                  onBook={handleOpenBooking}
                  onCancel={handleCancel}
                  onReschedule={handleReschedule}
                  readOnly={readOnlyMode}
                />
                <SlotColumn
                  period="evening"
                  slots={slotsByPeriod.evening}
                  onBook={handleOpenBooking}
                  onCancel={handleCancel}
                  onReschedule={handleReschedule}
                  readOnly={readOnlyMode}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Booking Modal */}
      <BookAppointmentModal
        isOpen={isBookingModalOpen}
        onClose={() => {
          setIsBookingModalOpen(false);
          setBookingSlot(null);
        }}
        slot={bookingSlot}
        doctor={selectedDoctor}
        selectedDate={selectedDate}
        onSuccess={handleBookingSuccess}
      />
    </div>
  );
}
