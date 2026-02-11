'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../components/AuthProvider';
import DoctorSelector from '../../../components/appointments/DoctorSelector';
import QueueCard from '../../../components/queue/QueueCard';
import ScheduledCard from '../../../components/queue/ScheduledCard';
import WalkInModal from '../../../components/queue/WalkInModal';
import {
  useDoctors,
  useDoctor,
  useQueueEntries,
  useAppointments,
  useUpdateQueueStatus,
  useCheckinAppointment,
  useMarkNoShow,
  useClinicTime,
  queueKeys,
} from '../../../lib/hooks/useQueueData';
import { usePageVisibility } from '../../../lib/hooks/usePageVisibility';
import { getMyAssignedDoctors, type QueueEntry, type QueueStatus, type Appointment, type AssignedDoctor } from '../../../lib/api';

// Format time in clinic timezone
function formatTimeInTimezone(isoString: string | undefined | null, timezone: string): string {
  if (!isoString) return '';
  try {
    return new Date(isoString).toLocaleTimeString('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return new Date(isoString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }
}

// Arrow component for flow visualization
function FlowArrow({ direction = 'right', label }: { direction?: 'right' | 'down' | 'split'; label?: string }) {
  if (direction === 'down') {
    return (
      <div className="flex justify-center py-0.5 flex-shrink-0">
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      </div>
    );
  }
  if (direction === 'split') {
    // Split arrow showing flow to both Waiting and With Doctor
    return (
      <div className="hidden lg:flex flex-col items-center justify-center px-1 flex-shrink-0">
        <svg className="w-8 h-full text-gray-400" viewBox="0 0 32 100" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M0 50 L16 50" strokeLinecap="round" />
          <path d="M16 50 L16 25 L28 25" strokeLinecap="round" />
          <path d="M16 50 L16 75 L28 75" strokeLinecap="round" />
          <path d="M24 21 L28 25 L24 29" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M24 71 L28 75 L24 79" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    );
  }
  return (
    <div className="hidden lg:flex items-center justify-center px-1 flex-shrink-0">
      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
      </svg>
    </div>
  );
}

// Tooltip component for reasons - positioned below to avoid header overlap
function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative inline-block" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && text && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 px-2 py-1 bg-gray-800 text-white text-[9px] rounded whitespace-nowrap z-[1000] max-w-[200px] break-words shadow-lg">
          {text}
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-gray-800" />
        </div>
      )}
    </div>
  );
}

// Priority indicator for queue cards
function PriorityIndicator({ priority }: { priority: 'NORMAL' | 'URGENT' | 'EMERGENCY' }) {
  if (priority === 'NORMAL') return null;
  const styles = {
    URGENT: 'bg-orange-500',
    EMERGENCY: 'bg-red-500 animate-pulse',
  };
  const labels = {
    URGENT: 'U',
    EMERGENCY: 'E',
  };
  return (
    <span className={`w-4 h-4 rounded-full ${styles[priority]} flex items-center justify-center flex-shrink-0`}>
      <span className="text-[8px] font-bold text-white">{labels[priority]}</span>
    </span>
  );
}

// Running timer component for consultation time
function ConsultationTimer({ startTime }: { startTime: string }) {
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    const updateTimer = () => {
      const start = new Date(startTime);
      const now = new Date();
      const diffMs = now.getTime() - start.getTime();
      const diffSecs = Math.floor(diffMs / 1000);
      const mins = Math.floor(diffSecs / 60);
      const secs = diffSecs % 60;
      if (mins < 60) {
        setElapsed(`${mins}:${secs.toString().padStart(2, '0')}`);
      } else {
        const hours = Math.floor(mins / 60);
        const remainMins = mins % 60;
        setElapsed(`${hours}:${remainMins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  return (
    <span className="font-mono text-teal-600 font-bold text-sm">{elapsed}</span>
  );
}

// Search input component
function SearchInput({
  value,
  onChange,
  placeholder = "Search..."
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <svg className="absolute left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-20 pl-5 pr-1.5 py-0.5 text-[10px] border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
      />
    </div>
  );
}

export default function QueuePage() {
  const { clinicId, isManager, clinicRole } = useAuth();
  const queryClient = useQueryClient();

  // Check if user is doctor-only (not manager/staff)
  const isDoctorOnly = clinicRole === 'CLINIC_DOCTOR' && !isManager;

  // Doctors can only interact with their own doctor box (check-in/out, complete)
  // They cannot: add walk-ins, check-in from scheduled, move patients through queue
  const canManageQueue = !isDoctorOnly;
  const isPageVisible = usePageVisibility();

  // Doctor selection state
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null);

  // Doctor check-in state with timestamps
  const [doctorCheckIn, setDoctorCheckIn] = useState<{
    isCheckedIn: boolean;
    checkInTime: string | null;
    checkOutTime: string | null;
  }>({ isCheckedIn: false, checkInTime: null, checkOutTime: null });

  // Modal state
  const [isWalkInModalOpen, setIsWalkInModalOpen] = useState(false);

  // Search states
  const [queueSearch, setQueueSearch] = useState('');
  const [scheduleSearch, setScheduleSearch] = useState('');
  const [completedSearch, setCompletedSearch] = useState('');

  // Get clinic time (current date in clinic timezone)
  const { data: clinicTime, isLoading: clinicTimeLoading } = useClinicTime();
  const clinicTimezone = clinicTime?.timezone || 'Asia/Kolkata';
  const clinicDate = clinicTime?.currentDate || '';

  // Queries with polling (only when page is visible)
  const { data: allDoctors = [], isLoading: doctorsLoading } = useDoctors();

  // Get assigned doctors for staff role filtering
  const { data: assignedDoctors = [] } = useQuery({
    queryKey: ['myAssignedDoctors'],
    queryFn: async () => {
      const { data, error } = await getMyAssignedDoctors();
      if (error) throw new Error(error.message);
      return data || [];
    },
    enabled: clinicRole === 'CLINIC_STAFF',
    staleTime: 5 * 60 * 1000,
  });

  // Filter doctors based on role:
  // - Managers see all licensed doctors
  // - Staff see only their assigned doctors
  // - Doctors see all licensed doctors (but only manage their own queue)
  const doctors = useMemo(() => {
    const licensedDoctors = allDoctors.filter(d => d.hasLicense === true);
    if (clinicRole === 'CLINIC_STAFF' && assignedDoctors.length > 0) {
      const assignedIds = new Set(assignedDoctors.map(d => d.id));
      return licensedDoctors.filter(d => assignedIds.has(d.id));
    }
    return licensedDoctors;
  }, [allDoctors, clinicRole, assignedDoctors]);

  const { data: selectedDoctor } = useDoctor(selectedDoctorId);
  const { data: queueEntries = [], isLoading: queueLoading, isFetching: queueFetching } = useQueueEntries(
    selectedDoctorId,
    { pollingEnabled: isPageVisible }
  );
  const { data: appointments = [] } = useAppointments(selectedDoctorId, {
    pollingEnabled: isPageVisible,
  });

  // Mutations
  const updateStatusMutation = useUpdateQueueStatus(selectedDoctorId);
  const checkinMutation = useCheckinAppointment(selectedDoctorId);
  const noShowMutation = useMarkNoShow(selectedDoctorId);

  // Auto-select first licensed doctor when loaded
  const handleDoctorsLoaded = useCallback(() => {
    if (doctors.length > 0 && !selectedDoctorId) {
      setSelectedDoctorId(doctors[0].id);
    }
  }, [doctors, selectedDoctorId]);

  // Effect to auto-select
  if (doctors.length > 0 && !selectedDoctorId) {
    setSelectedDoctorId(doctors[0].id);
  }

  // Derived data - categorize queue entries by status
  const queuedEntries = queueEntries.filter((e) => e.status === 'QUEUED');
  const waitingEntries = queueEntries.filter((e) => e.status === 'WAITING');
  const withDoctorEntries = queueEntries.filter((e) => e.status === 'WITH_DOCTOR');
  const completedEntries = queueEntries.filter((e) => e.status === 'COMPLETED');

  // Scheduled appointments (BOOKED status only)
  const scheduledAppointments = appointments.filter((a) => a.status === 'BOOKED');

  // Filtered data based on search
  const filteredQueuedEntries = useMemo(() => {
    if (!queueSearch.trim()) return queuedEntries;
    const search = queueSearch.toLowerCase();
    return queuedEntries.filter(e =>
      e.patient.fullName.toLowerCase().includes(search) ||
      e.patient.phone?.toLowerCase().includes(search)
    );
  }, [queuedEntries, queueSearch]);

  const filteredScheduledAppointments = useMemo(() => {
    if (!scheduleSearch.trim()) return scheduledAppointments;
    const search = scheduleSearch.toLowerCase();
    return scheduledAppointments.filter(a =>
      a.patient.fullName.toLowerCase().includes(search) ||
      a.patient.phone?.toLowerCase().includes(search)
    );
  }, [scheduledAppointments, scheduleSearch]);

  const filteredCompletedEntries = useMemo(() => {
    // Sort by completedAt descending (most recent first)
    const sorted = [...completedEntries].sort((a, b) => {
      const aTime = a.completedAt ? new Date(a.completedAt).getTime() : 0;
      const bTime = b.completedAt ? new Date(b.completedAt).getTime() : 0;
      return bTime - aTime;
    });
    if (!completedSearch.trim()) return sorted;
    const search = completedSearch.toLowerCase();
    return sorted.filter(e =>
      e.patient.fullName.toLowerCase().includes(search)
    );
  }, [completedEntries, completedSearch]);

  // Summary counts
  const summary = {
    queued: queuedEntries.length,
    waiting: waitingEntries.length,
    withDoctor: withDoctorEntries.length,
    scheduled: scheduledAppointments.length,
    done: completedEntries.length,
  };

  // Handlers
  const handleStatusChange = (entry: QueueEntry, newStatus: QueueStatus) => {
    updateStatusMutation.mutate({ entryId: entry.id, newStatus });
  };

  const handleCheckin = (appointment: Appointment) => {
    checkinMutation.mutate(appointment.id);
  };

  const handleNoShow = (appointment: Appointment) => {
    if (!window.confirm(`Mark ${appointment.patient.fullName} as No Show?`)) return;
    noShowMutation.mutate(appointment.id);
  };

  // Handler for marking queue entry as no-show
  const handleQueueNoShow = (entry: QueueEntry) => {
    if (!window.confirm(`Mark ${entry.patient.fullName} as No Show?`)) return;
    updateStatusMutation.mutate({ entryId: entry.id, newStatus: 'COMPLETED', outcome: 'NO_SHOW' });
  };

  // Handler for doctor check-in/out
  const handleDoctorCheckInOut = () => {
    if (doctorCheckIn.isCheckedIn) {
      // Prevent checkout if patient is still with doctor
      if (withDoctorEntries.length > 0) {
        alert('Cannot check out while a patient is being consulted. Please complete the consultation first.');
        return;
      }
      // Checking out
      setDoctorCheckIn({
        isCheckedIn: false,
        checkInTime: doctorCheckIn.checkInTime,
        checkOutTime: new Date().toISOString(),
      });
    } else {
      // Checking in
      setDoctorCheckIn({
        isCheckedIn: true,
        checkInTime: new Date().toISOString(),
        checkOutTime: null,
      });
    }
  };

  // Helper to calculate duration between two times
  const formatDuration = (startTime: string | null | undefined, endTime: string | null | undefined): string => {
    if (!startTime || !endTime) return '';
    const start = new Date(startTime);
    const end = new Date(endTime);
    const diffMs = end.getTime() - start.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins}m`;
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  // Check if we can send patient to doctor (doctor checked in AND no patient currently with doctor)
  const canSendToDoctor = doctorCheckIn.isCheckedIn && withDoctorEntries.length === 0;

  const handleRefresh = () => {
    // Use clinic date (in clinic timezone) for refresh
    if (!clinicDate) return;
    queryClient.invalidateQueries({
      queryKey: queueKeys.entries(clinicDate, selectedDoctorId || ''),
    });
    queryClient.invalidateQueries({
      queryKey: queueKeys.appointments(clinicDate, selectedDoctorId || ''),
    });
    // Also refresh clinic time
    queryClient.invalidateQueries({
      queryKey: queueKeys.clinicTime(),
    });
  };

  const handleWalkInSuccess = () => {
    handleRefresh();
  };

  const isLoading = doctorsLoading || queueLoading || clinicTimeLoading;
  const isRefreshing = queueFetching && !queueLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-140px)] overflow-hidden flex flex-col">
      {/* Compact Header */}
      <div className="flex items-center justify-between gap-2 mb-1 flex-shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="page-title text-lg">Daily Queue</h1>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
            title="Refresh"
          >
            <svg className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        {/* Summary chips - inline */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            <span className="text-[10px] text-blue-700 font-medium">{summary.queued}</span>
          </div>
          <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-50 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            <span className="text-[10px] text-amber-700 font-medium">{summary.waiting}</span>
          </div>
          <div className="flex items-center gap-1 px-2 py-0.5 bg-teal-50 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-500"></span>
            <span className="text-[10px] text-teal-700 font-medium">{summary.withDoctor}</span>
          </div>
          <div className="flex items-center gap-1 px-2 py-0.5 bg-purple-50 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
            <span className="text-[10px] text-purple-700 font-medium">{summary.scheduled}</span>
          </div>
          <div className="flex items-center gap-1 px-2 py-0.5 bg-green-50 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
            <span className="text-[10px] text-green-700 font-medium">{summary.done}</span>
          </div>
        </div>
      </div>

      {/* Doctor selector - compact bar */}
      <div className="bg-white rounded-lg border border-gray-200 px-2 py-1.5 mb-1 flex-shrink-0">
        <div className="lg:w-72">
          <DoctorSelector
            doctors={doctors}
            selectedDoctorId={selectedDoctorId}
            onSelect={(id) => {
              setSelectedDoctorId(id);
              setDoctorCheckIn({ isCheckedIn: false, checkInTime: null, checkOutTime: null });
            }}
            loading={doctorsLoading}
            showTitle={true}
          />
        </div>
      </div>

      {!selectedDoctor ? (
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-8 text-center flex-1">
          <svg className="w-10 h-10 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <p className="text-gray-500 text-xs">Select a doctor to view queue</p>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-1 flex-1 min-h-0 overflow-hidden">
          {/* Column 1: Scheduled + Queue */}
          <div className="flex-1 flex flex-col gap-0.5 min-h-0 min-w-0">
            {/* Today's Scheduled Panel - 1/4 height */}
            <div className="bg-violet-50/50 rounded-lg border border-gray-300 flex flex-col" style={{ height: '25%' }}>
              <div className="bg-violet-100/75 border-b border-violet-200 rounded-t-lg px-2 py-1 flex items-center justify-between gap-1 flex-shrink-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs">📅</span>
                  <span className="font-medium text-violet-700 text-[10px]">Scheduled</span>
                  <span className="text-[9px] bg-white/70 px-1 py-0.5 rounded text-violet-600 font-medium">
                    {summary.scheduled}
                  </span>
                </div>
                <SearchInput
                  value={scheduleSearch}
                  onChange={setScheduleSearch}
                  placeholder="Search..."
                />
              </div>
              <div className="p-1 space-y-0.5 flex-1 overflow-y-auto min-h-0">
                {filteredScheduledAppointments.length === 0 ? (
                  <div className="text-center py-1">
                    <p className="text-gray-400 text-[9px]">{scheduleSearch ? 'No matches' : 'No scheduled'}</p>
                  </div>
                ) : (
                  filteredScheduledAppointments.map((appt) => (
                    <div key={appt.id} className="bg-white border border-gray-200 rounded px-1.5 py-1 flex items-center gap-1 min-h-[26px]">
                      {/* Token placeholder - empty for scheduled */}
                      <span className="w-5 flex-shrink-0"></span>
                      {/* Time */}
                      <span className="text-[9px] text-gray-500 w-14 flex-shrink-0">
                        {formatTimeInTimezone(appt.startsAt, clinicTimezone)}
                      </span>
                      {/* Name */}
                      <span className="text-[9px] text-gray-800 font-medium truncate flex-1">{appt.patient.fullName}</span>
                      {/* Reason */}
                      <span className="w-16 flex-shrink-0 text-right">
                        {appt.reason ? (
                          <Tooltip text={appt.reason}>
                            <span className="text-[8px] text-gray-400 truncate inline-block max-w-full cursor-help">{appt.reason}</span>
                          </Tooltip>
                        ) : null}
                      </span>
                      {/* Actions */}
                      {canManageQueue && (
                        <div className="flex gap-1 flex-shrink-0 w-24 justify-end">
                          <button
                            onClick={() => handleCheckin(appt)}
                            disabled={checkinMutation.isPending}
                            className="text-[8px] py-0.5 px-1.5 bg-emerald-500 text-white rounded hover:bg-emerald-600 font-medium"
                          >
                            Check In
                          </button>
                          <button
                            onClick={() => handleNoShow(appt)}
                            disabled={noShowMutation.isPending}
                            className="text-[8px] py-0.5 px-1 text-red-500 hover:bg-red-50 rounded"
                          >
                            NS
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            <FlowArrow direction="down" />

            {/* Queue Panel (QUEUED) - 3/4 height */}
            <div className="bg-sky-50/50 rounded-lg border border-gray-300 flex-1 flex flex-col min-h-0">
              <div className="bg-sky-100/75 border-b border-sky-200 rounded-t-lg px-2 py-1 flex items-center justify-between gap-1 flex-shrink-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">📋</span>
                  <span className="font-medium text-sky-700 text-xs">Queue</span>
                  <span className="text-[10px] bg-white/70 px-1.5 py-0.5 rounded text-sky-600 font-medium">
                    {summary.queued}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <SearchInput
                    value={queueSearch}
                    onChange={setQueueSearch}
                    placeholder="Search..."
                  />
                  {canManageQueue && (
                    <button
                      onClick={() => setIsWalkInModalOpen(true)}
                      disabled={!selectedDoctor}
                      className="text-[9px] py-0.5 px-1.5 bg-sky-600 text-white rounded hover:bg-sky-700 font-medium"
                    >
                      +Walk-in
                    </button>
                  )}
                </div>
              </div>
              <div className="p-1.5 space-y-1 flex-1 overflow-y-auto min-h-0">
                {filteredQueuedEntries.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-gray-400 text-[10px]">{queueSearch ? 'No matches' : 'No patients in queue'}</p>
                  </div>
                ) : (
                  filteredQueuedEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className={`bg-white border rounded px-1.5 py-1 flex items-center gap-1 min-h-[26px] ${
                        entry.priority === 'EMERGENCY' ? 'border-red-300 bg-red-50/30' :
                        entry.priority === 'URGENT' ? 'border-orange-300 bg-orange-50/30' :
                        'border-gray-200'
                      }`}
                    >
                      {/* Token */}
                      <span className="w-5 h-5 rounded-full bg-sky-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-[9px] font-bold text-sky-700">{entry.position}</span>
                      </span>
                      {/* Priority indicator (overlaps with token area if present) */}
                      {entry.priority !== 'NORMAL' && <PriorityIndicator priority={entry.priority} />}
                      {/* Time */}
                      <span className="text-[9px] text-gray-500 w-14 flex-shrink-0">
                        {formatTimeInTimezone(entry.checkedInAt, clinicTimezone)}
                      </span>
                      {/* Name */}
                      <span className="text-[9px] text-gray-800 font-medium truncate flex-1">{entry.patient.fullName}</span>
                      {/* Reason */}
                      <span className="w-16 flex-shrink-0 text-right">
                        {entry.reason ? (
                          <Tooltip text={entry.reason}>
                            <span className="text-[8px] text-gray-400 truncate inline-block max-w-full cursor-help">{entry.reason}</span>
                          </Tooltip>
                        ) : null}
                      </span>
                      {/* Actions */}
                      {canManageQueue && (
                        <div className="flex gap-0.5 flex-shrink-0 w-24 justify-end">
                          <button
                            onClick={() => handleStatusChange(entry, 'WAITING')}
                            className="text-[8px] py-0.5 px-1 bg-amber-500 text-white rounded hover:bg-amber-600 font-medium"
                            title="Move to Waiting"
                          >
                            Call
                          </button>
                          {canSendToDoctor && (
                            <button
                              onClick={() => handleStatusChange(entry, 'WITH_DOCTOR')}
                              className="text-[8px] py-0.5 px-1 bg-teal-500 text-white rounded hover:bg-teal-600 font-medium"
                              title="Send to Doctor"
                            >
                              Send
                            </button>
                          )}
                          <button
                            onClick={() => handleQueueNoShow(entry)}
                            disabled={updateStatusMutation.isPending}
                            className="text-[8px] py-0.5 px-1 text-red-500 hover:bg-red-50 rounded"
                            title="Mark as No Show"
                          >
                            NS
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Split arrow from Queue to Waiting & With Doctor */}
          <FlowArrow direction="split" />

          {/* Column 2: Waiting + With Doctor */}
          <div className="flex-1 flex flex-col gap-0.5 min-h-0 min-w-0">
            {/* Waiting Panel */}
            <div className="bg-amber-50/40 rounded-lg border border-gray-300 flex-1 flex flex-col min-h-0">
              <div className="bg-amber-100/75 border-b border-amber-200 rounded-t-lg px-2 py-1 flex items-center justify-between gap-1 flex-shrink-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">⏳</span>
                  <span className="font-medium text-amber-700 text-xs">Waiting</span>
                  <span className="text-[10px] bg-white/70 px-1.5 py-0.5 rounded text-amber-600 font-medium">
                    {summary.waiting}
                  </span>
                </div>
              </div>
              <div className="p-1.5 space-y-1 flex-1 overflow-y-auto min-h-0">
                {waitingEntries.length === 0 ? (
                  <div className="text-center py-2">
                    <p className="text-gray-400 text-[10px]">No patients waiting</p>
                  </div>
                ) : (
                  waitingEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className={`bg-white border rounded px-1.5 py-1 flex items-center gap-1 min-h-[26px] ${
                        entry.priority === 'EMERGENCY' ? 'border-red-300 bg-red-50/30' :
                        entry.priority === 'URGENT' ? 'border-orange-300 bg-orange-50/30' :
                        'border-gray-200'
                      }`}
                    >
                      {/* Token */}
                      <span className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-[9px] font-bold text-amber-700">{entry.position}</span>
                      </span>
                      {/* Priority indicator */}
                      {entry.priority !== 'NORMAL' && <PriorityIndicator priority={entry.priority} />}
                      {/* Time */}
                      <span className="text-[9px] text-gray-500 w-14 flex-shrink-0">
                        {formatTimeInTimezone(entry.checkedInAt, clinicTimezone)}
                      </span>
                      {/* Name */}
                      <span className="text-[9px] text-gray-800 font-medium truncate flex-1">{entry.patient.fullName}</span>
                      {/* Reason */}
                      <span className="w-16 flex-shrink-0 text-right">
                        {entry.reason ? (
                          <Tooltip text={entry.reason}>
                            <span className="text-[8px] text-gray-400 truncate inline-block max-w-full cursor-help">{entry.reason}</span>
                          </Tooltip>
                        ) : null}
                      </span>
                      {/* Actions */}
                      {canManageQueue && canSendToDoctor && (
                        <div className="flex gap-0.5 flex-shrink-0 w-24 justify-end">
                          <button
                            onClick={() => handleStatusChange(entry, 'WITH_DOCTOR')}
                            className="text-[8px] py-0.5 px-1.5 bg-teal-500 text-white rounded hover:bg-teal-600 font-medium"
                          >
                            Send
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            <FlowArrow direction="down" />

            {/* With Doctor Panel - Redesigned */}
            <div className="bg-teal-50/40 rounded-lg border border-gray-300 flex-1 flex flex-col min-h-0">
              {/* Header - same height as other headers */}
              <div className="bg-teal-100/75 border-b border-teal-200 rounded-t-lg px-2 py-1 flex items-center justify-between gap-1 flex-shrink-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">👨‍⚕️</span>
                  <span className="font-medium text-teal-700 text-xs">With Doctor</span>
                </div>
                <button
                  onClick={handleDoctorCheckInOut}
                  className={`text-[9px] py-0.5 px-2 rounded font-medium flex items-center gap-1 transition-colors ${
                    doctorCheckIn.isCheckedIn
                      ? 'bg-red-500 text-white hover:bg-red-600'
                      : 'bg-emerald-500 text-white hover:bg-emerald-600'
                  }`}
                >
                  {doctorCheckIn.isCheckedIn ? (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                      Check Out
                    </>
                  ) : (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                      Check In
                    </>
                  )}
                </button>
              </div>

              {/* Doctor status bar - below header */}
              <div className="px-2 py-1 bg-teal-50/50 border-b border-teal-100/50 flex items-center justify-between text-[8px] flex-shrink-0">
                {doctorCheckIn.isCheckedIn ? (
                  <span className="text-emerald-700 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    Available since {formatTimeInTimezone(doctorCheckIn.checkInTime, clinicTimezone)}
                  </span>
                ) : doctorCheckIn.checkOutTime ? (
                  <span className="text-gray-500">
                    Last session: {formatTimeInTimezone(doctorCheckIn.checkInTime, clinicTimezone)} - {formatTimeInTimezone(doctorCheckIn.checkOutTime, clinicTimezone)}
                  </span>
                ) : (
                  <span className="text-red-600 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                    Not checked in
                  </span>
                )}
                {canManageQueue && canSendToDoctor && waitingEntries.length > 0 && (
                  <button
                    onClick={() => {
                      const firstWaiting = waitingEntries[0];
                      if (firstWaiting) handleStatusChange(firstWaiting, 'WITH_DOCTOR');
                    }}
                    className="text-[8px] py-0.5 px-1.5 bg-teal-600 text-white rounded hover:bg-teal-700 font-medium"
                  >
                    Call Next
                  </button>
                )}
              </div>

              {/* Patient area - centered display for single patient */}
              <div className="flex-1 flex flex-col items-center justify-center p-2 min-h-0">
                {!doctorCheckIn.isCheckedIn ? (
                  <div className="text-center">
                    <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-gray-100 flex items-center justify-center">
                      <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-gray-500 text-[10px]">Doctor not checked in</p>
                    <p className="text-gray-400 text-[8px]">Check in to start consultations</p>
                  </div>
                ) : withDoctorEntries.length === 0 ? (
                  <div className="text-center">
                    <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-teal-100 flex items-center justify-center">
                      <svg className="w-6 h-6 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="text-teal-700 text-[10px] font-medium">Ready for patient</p>
                    <p className="text-gray-400 text-[8px]">
                      {waitingEntries.length > 0
                        ? `${waitingEntries.length} patient(s) waiting`
                        : queuedEntries.length > 0
                          ? `${queuedEntries.length} in queue`
                          : 'No patients in queue'}
                    </p>
                  </div>
                ) : (
                  // Show the single patient being consulted - highlighted with running timer
                  withDoctorEntries.slice(0, 1).map((entry) => (
                    <div key={entry.id} className="w-full max-w-xs">
                      <div className={`bg-white border-2 rounded-lg p-3 shadow-sm ${
                        entry.priority === 'EMERGENCY' ? 'border-red-400' :
                        entry.priority === 'URGENT' ? 'border-orange-400' :
                        'border-teal-400'
                      }`}>
                        <div className="text-center mb-2">
                          <div className="flex items-center justify-center gap-2 mb-1">
                            <div className="w-10 h-10 rounded-full bg-teal-500 flex items-center justify-center">
                              <span className="text-white font-bold text-sm">
                                {entry.patient.fullName.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            {entry.priority !== 'NORMAL' && (
                              <span className={`px-2 py-0.5 rounded text-[9px] font-medium ${
                                entry.priority === 'EMERGENCY' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                              }`}>
                                {entry.priority}
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-semibold text-gray-800">{entry.patient.fullName}</p>
                          {entry.reason && (
                            <Tooltip text={entry.reason}>
                              <p className="text-[10px] text-gray-500 mt-0.5 truncate max-w-[180px] mx-auto cursor-help">{entry.reason}</p>
                            </Tooltip>
                          )}
                        </div>
                        {/* Running consultation timer */}
                        <div className="flex flex-col items-center border-t border-gray-100 pt-2 mt-2">
                          <span className="text-[8px] text-gray-400 mb-1">Consultation Time</span>
                          {entry.startedAt && <ConsultationTimer startTime={entry.startedAt} />}
                          <span className="text-[8px] text-gray-400 mt-0.5">
                            Started: {formatTimeInTimezone(entry.startedAt, clinicTimezone)}
                          </span>
                        </div>
                        <button
                          onClick={() => handleStatusChange(entry, 'COMPLETED')}
                          className="w-full mt-2 text-[10px] py-1.5 bg-emerald-500 text-white rounded hover:bg-emerald-600 font-medium"
                        >
                          Complete Consultation
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Arrow from With Doctor to Completed */}
          <FlowArrow direction="right" />

          {/* Column 3: Completed (full height) */}
          <div className="flex-1 flex flex-col min-h-0 min-w-0">
            <div className="bg-emerald-50/40 rounded-lg border border-gray-300 flex-1 flex flex-col min-h-0">
              <div className="bg-emerald-100/75 border-b border-emerald-200 rounded-t-lg px-2 py-1 flex items-center justify-between gap-1 flex-shrink-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">✅</span>
                  <span className="font-medium text-emerald-700 text-xs">Completed</span>
                  <span className="text-[10px] bg-white/70 px-1.5 py-0.5 rounded text-emerald-600 font-medium">
                    {summary.done}
                  </span>
                </div>
                <SearchInput
                  value={completedSearch}
                  onChange={setCompletedSearch}
                  placeholder="Search..."
                />
              </div>
              <div className="p-1.5 space-y-1 flex-1 overflow-y-auto min-h-0">
                {filteredCompletedEntries.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-gray-400 text-[10px]">{completedSearch ? 'No matches' : 'No completed visits'}</p>
                  </div>
                ) : (
                  filteredCompletedEntries.map((entry) => (
                    <div key={entry.id} className="bg-white/80 border border-gray-200 rounded px-1.5 py-1 flex items-center gap-1 min-h-[26px]">
                      {/* Token */}
                      <span className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-[9px] font-bold text-emerald-700">{entry.position}</span>
                      </span>
                      {/* Time - shows queue time for completed */}
                      <span className="text-[9px] text-gray-500 w-14 flex-shrink-0">
                        {formatTimeInTimezone(entry.checkedInAt, clinicTimezone)}
                      </span>
                      {/* Name */}
                      <span className="text-[9px] text-gray-800 font-medium truncate flex-1">{entry.patient.fullName}</span>
                      {/* Status/Duration column */}
                      <span className="w-16 flex-shrink-0 text-right">
                        {entry.outcome === 'NO_SHOW' ? (
                          <span className="text-[8px] text-red-500 font-medium bg-red-50 px-1 rounded">No Show</span>
                        ) : entry.startedAt && entry.completedAt ? (
                          <Tooltip text={`Consultation: ${formatDuration(entry.startedAt, entry.completedAt)}`}>
                            <span className="text-[8px] text-emerald-600 font-medium bg-emerald-50 px-1 rounded cursor-help">
                              {formatDuration(entry.startedAt, entry.completedAt)}
                            </span>
                          </Tooltip>
                        ) : null}
                      </span>
                      {/* Completed time */}
                      <span className="w-14 flex-shrink-0 text-right text-[9px] text-gray-400">
                        {entry.outcome !== 'NO_SHOW' && formatTimeInTimezone(entry.completedAt, clinicTimezone)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Walk-in Modal */}
      <WalkInModal
        isOpen={isWalkInModalOpen}
        onClose={() => setIsWalkInModalOpen(false)}
        doctor={selectedDoctor || null}
        onSuccess={handleWalkInSuccess}
      />
    </div>
  );
}
