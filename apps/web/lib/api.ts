'use client';

import { getToken, getClinicId } from './auth';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

// Types
export type User = {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: 'ADMIN' | 'USER' | 'VIEWER';
};

export type Clinic = {
  id: string;
  name: string;
  logoUrl?: string;
  phone?: string;
  address?: string;
  timezone: string;
  countryCode: string;
  authMode: string;
  isActive: boolean;
};

export type ClinicUserRole = 'CLINIC_MANAGER' | 'CLINIC_DOCTOR' | 'CLINIC_STAFF';

export type ClinicWithRole = Clinic & {
  clinicRole: ClinicUserRole;
  doctorId?: string | null;
};

export type LoginResponse = {
  ok: boolean;
  access_token: string;
  user: User;
};

export type ApiError = {
  message: string;
  statusCode: number;
  error?: string;
};

// Doctor types
export type DoctorSchedule = {
  id: string;
  clinicId: string;
  doctorId: string;
  dayOfWeek: number; // 0 = Sunday, 6 = Saturday
  startTime: string; // HH:MM format
  endTime: string;   // HH:MM format
  isEnabled: boolean;
};

export type Doctor = {
  id: string;
  clinicId: string;
  fullName: string;
  specialization: string;
  appointmentDurationMin: number;
  photoUrl?: string;
  hasLicense?: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  schedules?: DoctorSchedule[];
  _count?: { schedules: number };
};

// Queue types
export type QueueStatus = 'QUEUED' | 'WAITING' | 'WITH_DOCTOR' | 'COMPLETED' | 'CANCELLED';
export type QueuePriority = 'NORMAL' | 'URGENT' | 'EMERGENCY';
export type QueueSource = 'APPOINTMENT' | 'WALKIN';
export type QueueOutcome = 'DONE' | 'NO_SHOW';

export type QueueEntry = {
  id: string;
  clinicId: string;
  doctorId: string;
  patientId: string;
  queueDate: string;
  position: number;
  priority: QueuePriority;
  status: QueueStatus;
  source: QueueSource;
  outcome?: QueueOutcome;
  reason?: string;
  checkedInAt?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  patient: {
    id: string;
    fullName: string;
    phone?: string;
  };
  doctor: {
    id: string;
    fullName: string;
  };
};

// Appointment types
export type AppointmentStatus = 'BOOKED' | 'CHECKED_IN' | 'CANCELLED' | 'RESCHEDULED' | 'COMPLETED' | 'NO_SHOW';

export type Appointment = {
  id: string;
  clinicId: string;
  doctorId: string;
  patientId: string;
  startsAt: string;
  endsAt: string;
  reason?: string;
  status: AppointmentStatus;
  createdAt: string;
  updatedAt: string;
  patient: {
    id: string;
    fullName: string;
    phone?: string;
  };
  doctor: {
    id: string;
    fullName: string;
    specialization?: string;
  };
};

// Patient type
export type Patient = {
  id: string;
  clinicId: string;
  fullName: string;
  phone?: string;
  email?: string;
  dateOfBirth?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

// Base fetch wrapper
export async function apiFetch<T = unknown>(
  path: string,
  opts: RequestInit = {}
): Promise<{ data: T | null; error: ApiError | null; status: number }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as Record<string, string> || {}),
  };

  // Add auth token if available
  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Add clinic ID if available (for tenant-scoped endpoints)
  const clinicId = getClinicId();
  if (clinicId) {
    headers['x-clinic-id'] = clinicId;
  }

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...opts,
      headers,
    });

    const status = res.status;

    if (!res.ok) {
      let error: ApiError;
      try {
        error = await res.json();
      } catch {
        error = { message: 'Request failed', statusCode: status };
      }
      return { data: null, error, status };
    }

    const data = await res.json() as T;
    return { data, error: null, status };
  } catch (e) {
    return {
      data: null,
      error: { message: 'Network error', statusCode: 0 },
      status: 0,
    };
  }
}

// Auth helpers
export async function login(email: string, password: string) {
  return apiFetch<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function getMe() {
  return apiFetch<User>('/auth/me');
}

// Clinic helpers
export async function getClinicMe() {
  return apiFetch<ClinicWithRole>('/v1/clinic/me');
}

// Clinic time in timezone
export interface ClinicTime {
  timezone: string;
  currentDate: string;      // YYYY-MM-DD
  currentTime: string;      // HH:MM
  currentDateTime: string;  // Full datetime
  serverTime: string;       // ISO string
}

export async function getClinicTime() {
  return apiFetch<ClinicTime>('/v1/clinic/time');
}

// Doctor helpers
export async function listDoctors(options?: { licensedOnly?: boolean }) {
  const params = new URLSearchParams();
  if (options?.licensedOnly) {
    params.set('licensedOnly', 'true');
  }
  const queryString = params.toString();
  return apiFetch<Doctor[]>(`/v1/doctors${queryString ? `?${queryString}` : ''}`);
}

export async function getDoctor(doctorId: string) {
  return apiFetch<Doctor>(`/v1/doctors/${doctorId}`);
}

export async function getDoctorSchedules(doctorId: string) {
  return apiFetch<DoctorSchedule[]>(`/v1/doctors/${doctorId}/schedules`);
}

// Queue helpers
export async function listQueue(date: string, doctorId?: string) {
  const params = new URLSearchParams({ date });
  if (doctorId) {
    params.append('doctorId', doctorId);
  }
  return apiFetch<QueueEntry[]>(`/v1/queue?${params.toString()}`);
}

export async function createWalkin(data: {
  doctorId: string;
  patientName: string;
  patientPhone: string;
  priority?: QueuePriority;
  reason?: string;
}) {
  return apiFetch<QueueEntry>('/v1/queue/walkin', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Token types
export type QueueTokenResponse = {
  token: string;
  urlPath: string;
  expiresAt: string;
};

export type PublicQueueStatus = {
  clinicName: string;
  doctorName: string;
  position: number;
  status: QueueStatus;
  source: QueueSource; // WALKIN or APPOINTMENT
  peopleAhead: number;
  checkedInAt: string;
  isDoctorBusy: boolean;
  consultationDurationMin: number;
  estimatedWaitMinutes: number | null;
};

// TV Display types
export type TvDisplayPatient = {
  token: number;
  patientName: string;
  status: QueueStatus;
  priority: QueuePriority;
  estimatedWaitMin: number | null;
  checkedInAt: string | null;
};

export type TvDisplayDoctor = {
  doctorId: string;
  doctorName: string;
  consultationDuration: number;
  isCheckedIn: boolean;
  currentPatient: {
    token: number;
    patientName: string;
    startedAt: string | null;
  } | null;
  waitingCount: number;
  patients: TvDisplayPatient[];
};

export type TvDisplayData = {
  clinicName: string;
  timezone: string;
  generatedAt: string;
  doctors: TvDisplayDoctor[];
  totalWaiting: number;
  totalWithDoctor: number;
  totalInQueue: number;
};

// Issue public token for queue entry
export async function issueQueueToken(queueId: string) {
  return apiFetch<QueueTokenResponse>(`/v1/queue/${queueId}/token`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function updateQueueStatus(
  queueId: string,
  status: QueueStatus,
  outcome?: QueueOutcome
) {
  const body: { status: QueueStatus; outcome?: QueueOutcome } = { status };
  if (outcome) {
    body.outcome = outcome;
  }
  return apiFetch<QueueEntry>(`/v1/queue/${queueId}/status`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

// Doctor check-in/check-out types and functions
export type DoctorCheckInStatus = {
  isCheckedIn: boolean;
  checkInTime: string | null;
  checkOutTime: string | null;
};

export async function getDoctorCheckInStatus(doctorId: string) {
  return apiFetch<DoctorCheckInStatus>(`/v1/queue/doctor/${doctorId}/checkin`);
}

export async function doctorCheckIn(doctorId: string) {
  return apiFetch<DoctorCheckInStatus>(`/v1/queue/doctor/${doctorId}/checkin`, {
    method: 'POST',
  });
}

export async function doctorCheckOut(doctorId: string) {
  return apiFetch<DoctorCheckInStatus>(`/v1/queue/doctor/${doctorId}/checkout`, {
    method: 'POST',
  });
}

// Appointment helpers
export async function listAppointments(date: string, doctorId?: string) {
  const params = new URLSearchParams({ date });
  if (doctorId) {
    params.append('doctorId', doctorId);
  }
  return apiFetch<Appointment[]>(`/v1/appointments?${params.toString()}`);
}

export async function createAppointment(data: {
  doctorId: string;
  patientId: string;
  slotId?: string;
  startsAt?: string;
  reason?: string;
}) {
  return apiFetch<Appointment>('/v1/appointments', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function cancelAppointment(appointmentId: string) {
  return apiFetch<Appointment>(`/v1/appointments/${appointmentId}/cancel`, {
    method: 'PATCH',
  });
}

export async function rescheduleAppointment(appointmentId: string) {
  return apiFetch<Appointment>(`/v1/appointments/${appointmentId}/reschedule`, {
    method: 'PATCH',
  });
}

export async function checkinAppointment(appointmentId: string) {
  return apiFetch<QueueEntry>(`/v1/appointments/${appointmentId}/checkin`, {
    method: 'POST',
  });
}

export async function markAppointmentNoShow(appointmentId: string) {
  return apiFetch<Appointment>(`/v1/appointments/${appointmentId}/no-show`, {
    method: 'PATCH',
  });
}

// Patient helpers
export async function searchPatients(query: string, limit?: number) {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (limit) params.set('limit', limit.toString());
  return apiFetch<Patient[]>(`/v1/patients?${params.toString()}`);
}

export async function getPatients(limit?: number) {
  const params = new URLSearchParams();
  if (limit) params.set('limit', limit.toString());
  return apiFetch<Patient[]>(`/v1/patients?${params.toString()}`);
}

export async function getPatient(patientId: string) {
  return apiFetch<Patient>(`/v1/patients/${patientId}`);
}

export type PatientHistoryAppointment = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: string;
  reason?: string;
  doctor: { fullName: string };
};

export type PatientHistoryQueueEntry = {
  id: string;
  queueDate: string;
  checkedInAt?: string;
  startedAt?: string;
  completedAt?: string;
  status: string;
  source: 'APPOINTMENT' | 'WALKIN';
  reason?: string;
  outcome?: string;
  doctor: { fullName: string };
};

export type PatientHistory = {
  patient: { id: string; fullName: string };
  appointments: PatientHistoryAppointment[];
  queueEntries: PatientHistoryQueueEntry[];
};

export async function getPatientHistory(patientId: string) {
  return apiFetch<PatientHistory>(`/v1/patients/${patientId}/history`);
}

export async function createPatient(data: {
  fullName: string;
  phone?: string;
  email?: string;
}) {
  return apiFetch<Patient>('/v1/patients', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updatePatient(
  patientId: string,
  data: {
    fullName?: string;
    phone?: string;
  }
) {
  return apiFetch<Patient>(`/v1/patients/${patientId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

// Lookup helpers
export type Specialization = {
  id: string;
  value: string;
  sortOrder: number;
};

export async function getSpecializations() {
  return apiFetch<Specialization[]>('/v1/lookups/specializations');
}

// Generated slot type
export type GeneratedSlot = {
  id: string;
  time: string;       // HH:MM format in clinic timezone
  startsAt: string;   // ISO datetime (UTC)
  endsAt: string;     // ISO datetime (UTC)
  shift: 'MORNING' | 'EVENING';
  isAvailable: boolean;
  // Appointment info included for booked slots
  appointment?: {
    id: string;
    reason?: string;
    status?: AppointmentStatus;
    patient: {
      id: string;
      fullName: string;
      phone?: string;
    };
  };
};

export type SlotsGenerationResult = {
  slots: GeneratedSlot[];
  timezone: string;
  doctorDurationMin: number;
};

export type SlotsRangeResult = {
  days: { date: string; slots: GeneratedSlot[] }[];
  timezone: string;
  doctorDurationMin: number;
};

export type SlotsSummary = {
  totalDays: number;
  workingDays: number;
  totalSlots: number;
  availableSlots: number;
  bookedSlots: number;
  timezone: string;
  doctorDurationMin: number;
};

// Generate slots for a doctor on a specific date
export async function generateDoctorSlots(doctorId: string, date: string, includeBooked: boolean = true) {
  const statusParam = includeBooked ? 'all' : 'AVAILABLE';
  return apiFetch<SlotsGenerationResult>(`/v1/doctors/${doctorId}/slots?date=${date}&status=${statusParam}`);
}

// Generate slots for a date range
export async function generateDoctorSlotsRange(
  doctorId: string,
  startDate: string,
  endDate: string
) {
  return apiFetch<SlotsRangeResult>(
    `/v1/doctors/${doctorId}/slots/range?startDate=${startDate}&endDate=${endDate}`
  );
}

// Get slots summary for a date range
export async function getDoctorSlotsSummary(
  doctorId: string,
  startDate: string,
  endDate: string
) {
  return apiFetch<SlotsSummary>(
    `/v1/doctors/${doctorId}/slots/summary?startDate=${startDate}&endDate=${endDate}`
  );
}

// Public API fetch (no auth required)
export async function publicFetch<T = unknown>(
  path: string
): Promise<{ data: T | null; error: ApiError | null; status: number }> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
    });

    const status = res.status;

    if (!res.ok) {
      let error: ApiError;
      try {
        error = await res.json();
      } catch {
        error = { message: 'Request failed', statusCode: status };
      }
      return { data: null, error, status };
    }

    const data = await res.json() as T;
    return { data, error: null, status };
  } catch (e) {
    return {
      data: null,
      error: { message: 'Network error', statusCode: 0 },
      status: 0,
    };
  }
}

// Get public queue status by token
export async function getPublicQueueStatus(token: string) {
  return publicFetch<PublicQueueStatus>(`/p/${token}`);
}

// Get TV display data for waiting area (public)
export async function getTvDisplayData(clinicId: string) {
  return publicFetch<TvDisplayData>(`/tv/${clinicId}`);
}

// ============================================
// Doctor Schedule Types & API
// ============================================

export type ShiftType = 'MORNING' | 'EVENING';
export type TimeOffType = 'BREAK' | 'VACATION' | 'OTHER';

export type ShiftTemplate = {
  start: string;
  end: string;
} | null;

export type WeeklyShift = {
  dayOfWeek: number;
  shifts: {
    MORNING: boolean;
    EVENING: boolean;
  };
};

export type TimeOffEntry = {
  id: string;
  startDate: string;
  endDate: string;
  type: TimeOffType;
  reason: string | null;
};

export type DoctorScheduleData = {
  doctor: {
    id: string;
    fullName: string;
    specialization: string;
    appointmentDurationMin: number;
  };
  shiftTemplate: {
    MORNING: ShiftTemplate;
    EVENING: ShiftTemplate;
  };
  weekly: WeeklyShift[];
  timeOff: TimeOffEntry[];
};

export type UpdateSchedulePayload = {
  appointmentDurationMin?: number;
  shiftTemplate?: {
    MORNING?: { start: string; end: string };
    EVENING?: { start: string; end: string };
  };
  weekly?: Array<{
    dayOfWeek: number;
    shifts: {
      MORNING?: boolean;
      EVENING?: boolean;
    };
  }>;
};

export type CreateTimeOffPayload = {
  startDate: string;
  endDate: string;
  type: TimeOffType;
  reason?: string;
};

// Schedule conflict checking types
export type ConflictingAppointment = {
  id: string;
  startsAt: string;
  endsAt: string;
  patientName: string;
  patientPhone: string;
  reason: 'DURATION_MISMATCH' | 'SHIFT_DISABLED' | 'TIME_OUTSIDE_SHIFT';
};

export type ScheduleConflictCheckResult = {
  hasConflicts: boolean;
  conflictingAppointments: ConflictingAppointment[];
  totalConflicts: number;
};

export type UpdateScheduleWithConflictsResult = {
  schedule: DoctorScheduleData;
  cancelledAppointments: string[];
};

// Get doctor schedule (shift templates, weekly shifts, time off)
export async function getDoctorScheduleData(doctorId: string) {
  return apiFetch<DoctorScheduleData>(`/v1/doctors/${doctorId}/schedule`);
}

// Update doctor schedule
export async function updateDoctorSchedule(doctorId: string, data: UpdateSchedulePayload) {
  return apiFetch<DoctorScheduleData>(`/v1/doctors/${doctorId}/schedule`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// Check for schedule conflicts before updating
export async function checkScheduleConflicts(
  doctorId: string,
  data: UpdateSchedulePayload & { startDate?: string; endDate?: string },
) {
  return apiFetch<ScheduleConflictCheckResult>(`/v1/doctors/${doctorId}/schedule/check-conflicts`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Update schedule and resolve conflicts by cancelling appointments
export async function updateScheduleWithConflicts(
  doctorId: string,
  data: UpdateSchedulePayload & {
    cancelConflictingAppointments?: boolean;
    appointmentIdsToCancel?: string[];
  },
) {
  return apiFetch<UpdateScheduleWithConflictsResult>(`/v1/doctors/${doctorId}/schedule/with-conflicts`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// Create time off entry
export async function createTimeOff(doctorId: string, data: CreateTimeOffPayload) {
  return apiFetch<TimeOffEntry>(`/v1/doctors/${doctorId}/timeoff`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Delete time off entry
export async function deleteTimeOff(doctorId: string, timeOffId: string) {
  return apiFetch<void>(`/v1/doctors/${doctorId}/timeoff/${timeOffId}`, {
    method: 'DELETE',
  });
}

// ============================================
// Staff Dashboard Types & API
// ============================================

export type StaffScheduledItem = {
  appointmentId: string;
  time: string;
  patientName: string;
  phone: string | null;
  status: string;
};

export type StaffQueuedItem = {
  queueEntryId: string;
  queueNumber: number;
  patientName: string;
  priority: string;
  checkedInAt: string;
  status: string;
};

export type StaffWaitingLongItem = {
  queueEntryId: string;
  queueNumber: number;
  patientName: string;
  minutesWaiting: number;
  priority: string;
};

export type StaffWithDoctorItem = {
  queueEntryId: string;
  queueNumber: number;
  patientName: string;
  startedAt: string;
  elapsedMin: number;
};

export type StaffDashboardData = {
  date: string;
  clinic: { id: string; name: string };
  counts: {
    scheduled: number;
    queued: number;
    waiting: number;
    withDoctor: number;
    done: number;
    noShow: number;
  };
  scheduledList: StaffScheduledItem[];
  queuedList: StaffQueuedItem[];
  waitingLong: StaffWaitingLongItem[];
  withDoctor: StaffWithDoctorItem | null;
};

// Get staff dashboard data
export async function getStaffDashboard(date: string, doctorId?: string) {
  const params = new URLSearchParams({ date });
  if (doctorId) {
    params.append('doctorId', doctorId);
  }
  return apiFetch<StaffDashboardData>(`/v1/dashboard/staff?${params.toString()}`);
}

// ============================================
// Doctor Dashboard Types & API
// ============================================

export type DoctorWaitingNextItem = {
  queueEntryId: string;
  queueNumber: number;
  patientName: string;
  minutesWaiting: number;
  priority: string;
};

export type DoctorDashboardData = {
  date: string;
  doctor: { id: string; fullName: string };
  now: StaffWithDoctorItem | null;
  waitingNext: DoctorWaitingNextItem[];
  stats: {
    seen: number;
    waiting: number;
    avgWaitMin: number;
    avgConsultMin: number;
    noShowRate: number;
  };
};

// Get doctor dashboard data
export async function getDoctorDashboard(date: string, doctorId?: string) {
  const params = new URLSearchParams({ date });
  if (doctorId) {
    params.append('doctorId', doctorId);
  }
  return apiFetch<DoctorDashboardData>(`/v1/dashboard/doctor?${params.toString()}`);
}

// ============================================
// Manager Dashboard Types & API
// ============================================

export type ManagerByDoctorItem = {
  doctorId: string;
  doctorName: string;
  total: number;
  completed: number;
  noShowRate: number;
  avgWaitMin: number;
  utilizationPct: number;
};

export type ManagerByDayItem = {
  date: string;
  appointments: number;
  completed: number;
  noShows: number;
  avgWaitMin: number;
  avgConsultMin: number;
};

export type ManagerDashboardData = {
  range: { from: string; to: string };
  kpis: {
    totalAppointments: number;
    completionPct: number;
    noShowRate: number;
    avgWaitMin: number;
    avgConsultMin: number;
    walkinPct: number;
  };
  byDoctor: ManagerByDoctorItem[];
  byDay: ManagerByDayItem[];
};

// Get manager dashboard data
export async function getManagerDashboard(from: string, to: string, doctorId?: string) {
  const params = new URLSearchParams({ from, to });
  if (doctorId) {
    params.append('doctorId', doctorId);
  }
  return apiFetch<ManagerDashboardData>(`/v1/dashboard/manager?${params.toString()}`);
}

// ============================================
// Reports Types & API
// ============================================

// Overview Report Types
export type OverviewKpis = {
  totalAppointments: number;
  bookedAppointments: number;
  completedAppointments: number;
  cancelledAppointments: number;
  noShowCount: number;
  noShowRate: number;
  avgWaitMin: number;
  avgConsultMin: number;
  walkinPct: number;
};

export type OverviewByDayItem = {
  date: string;
  appointments: number;
  completed: number;
  cancelled: number;
  noShows: number;
  avgWaitMin: number;
  avgConsultMin: number;
  walkins: number;
};

export type OverviewByDoctorItem = {
  doctorId: string;
  doctorName: string;
  appointments: number;
  completed: number;
  noShows: number;
  avgWaitMin: number;
  utilizationPct: number | null;
};

export type OverviewReportData = {
  range: { from: string; to: string };
  kpis: OverviewKpis;
  byDay: OverviewByDayItem[];
  byDoctor: OverviewByDoctorItem[];
};

// No-Shows Report Types
export type NoShowByDowItem = {
  dow: number; // 0 = Sunday, 6 = Saturday
  total: number;
  noShows: number;
  noShowRate: number;
};

export type NoShowByHourItem = {
  hour: number; // 0-23
  total: number;
  noShows: number;
  noShowRate: number;
};

export type NoShowsReportData = {
  range: { from: string; to: string };
  byDow: NoShowByDowItem[];
  byHour: NoShowByHourItem[];
};

// Wait Times Report Types
export type WaitTimeDistributionItem = {
  bucket: string;
  count: number;
};

export type WaitTimeByDayItem = {
  date: string;
  avgWaitMin: number;
  avgConsultMin: number;
};

export type WaitTimesReportData = {
  range: { from: string; to: string };
  avgWaitMin: number;
  avgConsultMin: number;
  distribution: WaitTimeDistributionItem[];
  byDay: WaitTimeByDayItem[];
};

// Get overview report
export async function getOverviewReport(from: string, to: string, doctorId?: string) {
  const params = new URLSearchParams({ from, to });
  if (doctorId) {
    params.append('doctorId', doctorId);
  }
  return apiFetch<OverviewReportData>(`/v1/reports/overview?${params.toString()}`);
}

// Get no-shows report
export async function getNoShowsReport(from: string, to: string, doctorId?: string) {
  const params = new URLSearchParams({ from, to });
  if (doctorId) {
    params.append('doctorId', doctorId);
  }
  return apiFetch<NoShowsReportData>(`/v1/reports/no-shows?${params.toString()}`);
}

// Get wait times report
export async function getWaitTimesReport(from: string, to: string, doctorId?: string) {
  const params = new URLSearchParams({ from, to });
  if (doctorId) {
    params.append('doctorId', doctorId);
  }
  return apiFetch<WaitTimesReportData>(`/v1/reports/wait-times?${params.toString()}`);
}

// ============================================
// New Reports Types & API (Patients, Queue, Appointments, Doctor Check-ins)
// ============================================

// Patient Report Types
export type PatientReportItem = {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  createdAt: string;
  lastVisitDate: string | null;
  totalVisits: number;
};

export type PatientsReportData = {
  total: number;
  patients: PatientReportItem[];
};

// Queue Report Types
export type QueueReportItem = {
  id: string;
  date: string;
  position: number;
  patientName: string;
  patientPhone: string | null;
  doctorName: string;
  doctorId: string;
  status: string;
  outcome: string | null;
  source: string;
  priority: string;
  checkedInAt: string;
  startedAt: string | null;
  completedAt: string | null;
  waitMinutes: number | null;
  consultMinutes: number | null;
};

export type QueueReportData = {
  range: { from: string; to: string };
  total: number;
  entries: QueueReportItem[];
};

// Appointments Report Types
export type AppointmentReportItem = {
  id: string;
  date: string;
  time: string;
  patientName: string;
  patientPhone: string | null;
  doctorName: string;
  doctorId: string;
  status: string;
  reason: string | null;
  createdAt: string;
};

export type AppointmentsReportData = {
  range: { from: string; to: string };
  total: number;
  appointments: AppointmentReportItem[];
};

// Doctor Check-ins Report Types
export type DoctorCheckinItem = {
  id: string;
  date: string;
  doctorId: string;
  doctorName: string;
  checkInTime: string;
  checkOutTime: string | null;
  hoursWorked: number | null;
};

export type DoctorCheckinsData = {
  range: { from: string; to: string };
  total: number;
  checkins: DoctorCheckinItem[];
};

// Get patients report
export async function getPatientsReport(options?: {
  from?: string;
  to?: string;
  status?: string;
  limit?: number;
  offset?: number;
}) {
  const params = new URLSearchParams();
  if (options?.from) params.append('from', options.from);
  if (options?.to) params.append('to', options.to);
  if (options?.status) params.append('status', options.status);
  if (options?.limit) params.append('limit', options.limit.toString());
  if (options?.offset) params.append('offset', options.offset.toString());
  const queryString = params.toString();
  return apiFetch<PatientsReportData>(`/v1/reports/patients${queryString ? `?${queryString}` : ''}`);
}

// Get queue report
export async function getQueueReport(from: string, to: string, options?: {
  doctorId?: string;
  status?: string;
}) {
  const params = new URLSearchParams({ from, to });
  if (options?.doctorId) params.append('doctorId', options.doctorId);
  if (options?.status) params.append('status', options.status);
  return apiFetch<QueueReportData>(`/v1/reports/queue?${params.toString()}`);
}

// Get appointments report
export async function getAppointmentsReport(from: string, to: string, options?: {
  doctorId?: string;
  status?: string;
}) {
  const params = new URLSearchParams({ from, to });
  if (options?.doctorId) params.append('doctorId', options.doctorId);
  if (options?.status) params.append('status', options.status);
  return apiFetch<AppointmentsReportData>(`/v1/reports/appointments?${params.toString()}`);
}

// Get doctor check-ins report
export async function getDoctorCheckinsReport(from: string, to: string, doctorId?: string) {
  const params = new URLSearchParams({ from, to });
  if (doctorId) params.append('doctorId', doctorId);
  return apiFetch<DoctorCheckinsData>(`/v1/reports/doctor-checkins?${params.toString()}`);
}

// ============================================
// Admin API - Clinic/Hospital Management
// ============================================

export type CountryConfig = {
  phonePrefix: string;
  timezone: string;
  name: string;
};

export type CountryConfigMap = Record<string, CountryConfig>;

export type AdminClinic = {
  id: string;
  name: string;
  logoUrl: string | null;
  pictureUrl: string | null;
  phone: string | null;
  countryCode: string;
  timezone: string;
  street: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  licensesTotal: number;
  licensesUsed: number;
  licensesAvailable: number;
  authMode: 'PASSWORD' | 'PHONE_OTP';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  phonePrefix: string;
  stats: {
    doctors: number;
    patients: number;
    staff: number;
  };
};

export type AdminDoctor = {
  id: string;
  fullName: string;
  specialization: string;
  phone: string | null;
  email: string | null;
  photoUrl: string | null;
  hasLicense: boolean;
  licenseAssignedAt: string | null;
  isActive: boolean;
  createdAt: string;
};

export type LicensePurchase = {
  id: string;
  quantity: number;
  pricePerLicense: number;
  totalAmount: number;
  currency: string;
  paymentRef: string | null;
  paymentMethod: string | null;
  notes: string | null;
  purchasedAt: string;
};

export type AdminClinicDetail = Omit<AdminClinic, 'stats'> & {
  doctors: AdminDoctor[];
  clinicUsers: Array<{
    id: string;
    role: string;
    isActive: boolean;
    user: {
      id: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
    };
  }>;
  licensePurchases: LicensePurchase[];
  stats: {
    patients: number;
    appointments: number;
    queueEntries: number;
  };
};

export type CreateClinicData = {
  name: string;
  phone?: string;
  countryCode?: string;
  timezone?: string;
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  logoUrl?: string;
  pictureUrl?: string;
  authMode?: 'PASSWORD' | 'PHONE_OTP';
};

export type UpdateClinicData = {
  name?: string;
  phone?: string;
  countryCode?: string;
  timezone?: string;
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  logoUrl?: string;
  pictureUrl?: string;
  authMode?: 'PASSWORD' | 'PHONE_OTP';
  isActive?: boolean;
};

// Get country config (Admin only)
export async function adminGetCountries() {
  return apiFetch<CountryConfigMap>('/admin/clinics/countries');
}

// List all clinics (Admin only)
export async function adminListClinics() {
  return apiFetch<AdminClinic[]>('/admin/clinics');
}

// Get single clinic (Admin only)
export async function adminGetClinic(id: string) {
  return apiFetch<AdminClinicDetail>(`/admin/clinics/${id}`);
}

// Create clinic (Admin only)
export async function adminCreateClinic(data: CreateClinicData) {
  return apiFetch<AdminClinic>('/admin/clinics', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Update clinic (Admin only)
export async function adminUpdateClinic(id: string, data: UpdateClinicData) {
  return apiFetch<AdminClinic>(`/admin/clinics/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// Delete/deactivate clinic (Admin only)
export async function adminDeleteClinic(id: string) {
  return apiFetch<AdminClinic>(`/admin/clinics/${id}`, {
    method: 'DELETE',
  });
}

// Add staff to clinic (Admin only)
export async function adminAddClinicStaff(
  clinicId: string,
  userId: string,
  role: 'CLINIC_MANAGER' | 'CLINIC_DOCTOR' | 'CLINIC_STAFF'
) {
  return apiFetch(`/admin/clinics/${clinicId}/staff`, {
    method: 'POST',
    body: JSON.stringify({ userId, role }),
  });
}

// Remove staff from clinic (Admin only)
export async function adminRemoveClinicStaff(clinicId: string, userId: string) {
  return apiFetch(`/admin/clinics/${clinicId}/staff/${userId}`, {
    method: 'DELETE',
  });
}

// Create manager data type
export type CreateManagerData = {
  email: string;
  firstName: string;
  lastName?: string;
  password: string;
  phone?: string;
};

// Create manager for clinic (Admin only)
export async function adminCreateManager(clinicId: string, data: CreateManagerData) {
  return apiFetch(`/admin/clinics/${clinicId}/managers`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Update staff data type
export type UpdateStaffData = {
  role?: 'CLINIC_MANAGER' | 'CLINIC_DOCTOR' | 'CLINIC_STAFF';
  isActive?: boolean;
};

// Update staff member (Admin only)
export async function adminUpdateStaff(clinicId: string, staffId: string, data: UpdateStaffData) {
  return apiFetch(`/admin/clinics/${clinicId}/staff/${staffId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// ============================================
// Admin API - Doctor Management
// ============================================

export type CreateDoctorData = {
  fullName: string;
  specialization: string;
  phone?: string;
  email?: string;
  photoUrl?: string;
  appointmentDurationMin?: number;
};

export type UpdateDoctorData = {
  fullName?: string;
  specialization?: string;
  phone?: string;
  email?: string;
  photoUrl?: string;
  appointmentDurationMin?: number;
  isActive?: boolean;
};

// Create doctor (Admin only)
export async function adminCreateDoctor(clinicId: string, data: CreateDoctorData) {
  return apiFetch<AdminDoctor>(`/admin/clinics/${clinicId}/doctors`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Update doctor (Admin only)
export async function adminUpdateDoctor(clinicId: string, doctorId: string, data: UpdateDoctorData) {
  return apiFetch<AdminDoctor>(`/admin/clinics/${clinicId}/doctors/${doctorId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// Delete/deactivate doctor (Admin only)
export async function adminDeleteDoctor(clinicId: string, doctorId: string) {
  return apiFetch<AdminDoctor>(`/admin/clinics/${clinicId}/doctors/${doctorId}`, {
    method: 'DELETE',
  });
}

// ============================================
// Admin API - License Management
// ============================================

export type PurchaseLicensesData = {
  quantity: number;
  pricePerLicense: number;
  currency?: string;
  paymentRef?: string;
  paymentMethod?: string;
  notes?: string;
};

// Purchase licenses (Admin only)
export async function adminPurchaseLicenses(clinicId: string, data: PurchaseLicensesData) {
  return apiFetch<LicensePurchase>(`/admin/clinics/${clinicId}/licenses/purchase`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Get license purchase history (Admin only)
export async function adminGetLicensePurchases(clinicId: string) {
  return apiFetch<LicensePurchase[]>(`/admin/clinics/${clinicId}/licenses`);
}

// Assign license to doctor (Admin only)
export async function adminAssignLicense(clinicId: string, doctorId: string) {
  return apiFetch<AdminDoctor>(`/admin/clinics/${clinicId}/doctors/${doctorId}/license`, {
    method: 'POST',
  });
}

// Revoke license from doctor (Admin only)
export async function adminRevokeLicense(clinicId: string, doctorId: string) {
  return apiFetch<AdminDoctor>(`/admin/clinics/${clinicId}/doctors/${doctorId}/license`, {
    method: 'DELETE',
  });
}

// ============================================
// Manager API - Doctor/License/Staff Management
// ============================================

export type ManagerDoctor = {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  specialization: string;
  phone: string | null;
  email: string | null;
  photoUrl: string | null;
  appointmentDurationMin: number;
  hasLicense: boolean;
  licenseAssignedAt: string | null;
  isActive: boolean;
  createdAt: string;
  // User account info
  hasUserAccount: boolean;
  clinicRole: 'CLINIC_MANAGER' | 'CLINIC_DOCTOR' | null;
  // Stats removed for performance - counting all historical records was slow
  stats?: {
    appointments: number;
    queueEntries: number;
  };
};

export type AssignedDoctor = {
  id: string;
  fullName: string;
  hasLicense: boolean;
};

export type ManagerStaff = {
  id: string;
  role: string;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
  assignedDoctors?: AssignedDoctor[];
};

export type ManagerLicenseInfo = {
  total: number;
  used: number;
  available: number;
};

export type ManagerClinicStats = {
  clinic: {
    id: string;
    name: string;
    licensesTotal: number;
    licensesUsed: number;
    licensesAvailable: number;
  };
  counts: {
    doctors: number;
    activeDoctors: number;
    licensedDoctors: number;
    patients: number;
    staff: number;
    appointments: number;
    queueEntries: number;
  };
};

export type CreateManagerDoctorData = {
  firstName: string;
  lastName: string;
  specialization: string;
  phone?: string;
  email?: string;
  photoUrl?: string;
  appointmentDurationMin?: number;
  // User account creation options
  createUserAccount?: boolean;
  password?: string;
  isManager?: boolean;
};

export type UpdateManagerDoctorData = {
  firstName?: string;
  lastName?: string;
  specialization?: string;
  phone?: string;
  email?: string;
  photoUrl?: string;
  appointmentDurationMin?: number;
  isActive?: boolean;
  // User account management
  createUserAccount?: boolean;
  password?: string;
  isManager?: boolean;
};

export type CreateStaffData = {
  email: string;
  firstName: string;
  lastName?: string;
  password: string;
  phone?: string;
  role: 'CLINIC_STAFF' | 'CLINIC_DOCTOR';
};

// Get clinic stats (Manager only)
export async function managerGetStats() {
  return apiFetch<ManagerClinicStats>('/v1/manager/stats');
}

// List doctors (Manager only)
export async function managerListDoctors() {
  return apiFetch<ManagerDoctor[]>('/v1/manager/doctors');
}

// Get single doctor (Manager only)
export async function managerGetDoctor(doctorId: string) {
  return apiFetch<ManagerDoctor>(`/v1/manager/doctors/${doctorId}`);
}

// Create doctor (Manager only)
export async function managerCreateDoctor(data: CreateManagerDoctorData) {
  return apiFetch<ManagerDoctor>('/v1/manager/doctors', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Update doctor (Manager only)
export async function managerUpdateDoctor(doctorId: string, data: UpdateManagerDoctorData) {
  return apiFetch<ManagerDoctor>(`/v1/manager/doctors/${doctorId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// Deactivate doctor (Manager only)
export async function managerDeactivateDoctor(doctorId: string) {
  return apiFetch<ManagerDoctor>(`/v1/manager/doctors/${doctorId}`, {
    method: 'DELETE',
  });
}

// Get license info (Manager only)
export async function managerGetLicenseInfo() {
  return apiFetch<ManagerLicenseInfo>('/v1/manager/licenses');
}

// Assign license to doctor (Manager only)
export async function managerAssignLicense(doctorId: string) {
  return apiFetch<ManagerDoctor>(`/v1/manager/doctors/${doctorId}/license`, {
    method: 'POST',
  });
}

// Revoke license from doctor (Manager only)
export async function managerRevokeLicense(doctorId: string) {
  return apiFetch<ManagerDoctor>(`/v1/manager/doctors/${doctorId}/license`, {
    method: 'DELETE',
  });
}

// List staff (Manager only)
export async function managerListStaff() {
  return apiFetch<ManagerStaff[]>('/v1/manager/staff');
}

// Add staff member (Manager only)
export async function managerAddStaff(data: CreateStaffData) {
  return apiFetch<ManagerStaff>('/v1/manager/staff', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Update staff member (Manager only)
export async function managerUpdateStaff(staffId: string, data: { role?: string; phone?: string; isActive?: boolean }) {
  return apiFetch<ManagerStaff>(`/v1/manager/staff/${staffId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// Remove staff member (Manager only)
export async function managerRemoveStaff(staffId: string) {
  return apiFetch<ManagerStaff>(`/v1/manager/staff/${staffId}`, {
    method: 'DELETE',
  });
}

// Get licensed doctors available for assignment (Manager only)
export async function managerGetLicensedDoctors() {
  return apiFetch<AssignedDoctor[]>('/v1/manager/licensed-doctors');
}

// Get staff member's assigned doctors (Manager only)
export async function managerGetStaffDoctors(staffId: string) {
  return apiFetch<AssignedDoctor[]>(`/v1/manager/staff/${staffId}/doctors`);
}

// Update staff member's doctor assignments (Manager only)
export async function managerUpdateStaffDoctors(staffId: string, doctorIds: string[]) {
  return apiFetch<AssignedDoctor[]>(`/v1/manager/staff/${staffId}/doctors`, {
    method: 'PUT',
    body: JSON.stringify({ doctorIds }),
  });
}

// Get current user's assigned doctors (filtered by role)
export async function getMyAssignedDoctors() {
  return apiFetch<AssignedDoctor[]>('/v1/doctors/my-assigned');
}

// ============================================
// Admin API - Slot Management
// ============================================

export type AdminDoctorSlotStatus = {
  doctorId: string;
  doctorName: string;
  hasLicense: boolean;
  isActive: boolean;
  scheduleConfiguredAt: string | null;
  hasSchedule: boolean;
  slotsGeneratedFrom: string | null;  // YYYY-MM-DD or null
  slotsGeneratedTo: string | null;    // YYYY-MM-DD or null
  slotCount: number;
  availableSlots: number;
  bookedSlots: number;
  blockedSlots: number;
  earliestSlot: string | null;
  latestSlot: string | null;
};

export type AdminClinicSlotStatus = {
  clinicId: string;
  clinicName: string;
  totalDoctors: number;
  configuredDoctors: number;
  licensedDoctors: number;
  totalSlots: number;
  doctors: AdminDoctorSlotStatus[];
};

export type AdminSlotGenerationResult = {
  clinicId: string;
  results: Array<{
    doctorId: string;
    doctorName: string;
    success: boolean;
    slotsCreated: number;
    error?: string;
  }>;
  totalSlotsCreated: number;
  processedCount: number;
  errorCount: number;
};

export type AdminDoctorSlotGenerationResult = {
  doctorId: string;
  doctorName: string;
  slotsCreated: number;
  startDate: string;
  endDate: string;
};

// Get slot status for a clinic (Admin only)
export async function adminGetClinicSlotStatus(clinicId: string) {
  return apiFetch<AdminClinicSlotStatus>(`/admin/clinics/${clinicId}/slots/status`);
}

// Bulk generate slots for all doctors in a clinic (Admin only)
export async function adminBulkGenerateSlots(clinicId: string) {
  return apiFetch<AdminSlotGenerationResult>(`/admin/clinics/${clinicId}/slots/generate`, {
    method: 'POST',
  });
}

// Generate slots for a specific doctor with date range (Admin only)
export async function adminGenerateDoctorSlots(
  clinicId: string,
  doctorId: string,
  startDate?: string,  // YYYY-MM-DD format
  endDate?: string,    // YYYY-MM-DD format
) {
  return apiFetch<AdminDoctorSlotGenerationResult>(`/admin/clinics/${clinicId}/doctors/${doctorId}/slots/generate`, {
    method: 'POST',
    body: JSON.stringify({ startDate, endDate }),
  });
}

// Clear future slots for a doctor (Admin only)
export async function adminClearDoctorSlots(clinicId: string, doctorId: string) {
  return apiFetch<{ deletedCount: number }>(`/admin/clinics/${clinicId}/doctors/${doctorId}/slots`, {
    method: 'DELETE',
  });
}
