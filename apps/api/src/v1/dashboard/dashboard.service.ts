import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

// Helper to convert clinic local time to UTC
function clinicTimeToUTC(
  date: string,      // YYYY-MM-DD
  time: string,      // HH:MM
  timezone: string,  // IANA timezone
): Date {
  const [year, month, day] = date.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);

  // Create a date in UTC first
  const utcDate = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0, 0));

  // Get the offset between clinic timezone and UTC for this date/time
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

// ============================================
// DTOs for Staff Dashboard
// ============================================

export interface StaffScheduledItem {
  appointmentId: string;
  time: string;
  patientName: string;
  phone: string | null;
  status: string;
}

export interface StaffQueuedItem {
  queueEntryId: string;
  queueNumber: number;
  patientName: string;
  priority: string;
  checkedInAt: string;
  status: string;
}

export interface StaffWaitingLongItem {
  queueEntryId: string;
  queueNumber: number;
  patientName: string;
  minutesWaiting: number;
  priority: string;
}

export interface StaffWithDoctorItem {
  queueEntryId: string;
  queueNumber: number;
  patientName: string;
  startedAt: string;
  elapsedMin: number;
}

export interface StaffDashboardResponse {
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
}

// ============================================
// DTOs for Doctor Dashboard
// ============================================

export interface DoctorWaitingNextItem {
  queueEntryId: string;
  queueNumber: number;
  patientName: string;
  minutesWaiting: number;
  priority: string;
}

export interface DoctorDashboardResponse {
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
}

// ============================================
// DTOs for Manager Dashboard
// ============================================

export interface ManagerByDoctorItem {
  doctorId: string;
  doctorName: string;
  total: number;
  completed: number;
  noShowRate: number;
  avgWaitMin: number;
  utilizationPct: number;
}

export interface ManagerByDayItem {
  date: string;
  appointments: number;
  completed: number;
  noShows: number;
  avgWaitMin: number;
  avgConsultMin: number;
}

export interface ManagerDashboardResponse {
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
}

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  // Helper to parse date string
  private parseDate(dateStr: string): Date {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      throw new BadRequestException(`Invalid date format: ${dateStr}`);
    }
    return date;
  }

  // Helper to get UTC midnight date for @db.Date fields
  // PostgreSQL DATE type stores only the date portion, compared at UTC midnight
  private toQueueDate(dateStr: string): Date {
    // Ensure we always use UTC midnight for @db.Date field queries
    return new Date(dateStr + 'T00:00:00.000Z');
  }

  // Helper to calculate minutes between two dates
  private minutesBetween(start: Date, end: Date): number {
    return Math.round((end.getTime() - start.getTime()) / 60000);
  }

  // ============================================
  // Staff Dashboard
  // ============================================

  async getStaffDashboard(
    clinicId: string,
    date: string,
    doctorId?: string,
  ): Promise<StaffDashboardResponse> {
    const now = new Date();

    // Get clinic info including timezone
    const clinic = await this.prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { id: true, name: true, timezone: true },
    });

    if (!clinic) {
      throw new NotFoundException('Clinic not found');
    }

    // Use clinic timezone to calculate date range in UTC
    const timezone = clinic.timezone || 'UTC';
    const dayStartUTC = clinicTimeToUTC(date, '00:00', timezone);
    const dayEndUTC = clinicTimeToUTC(date, '23:59', timezone);
    // Add 1 minute to include appointments at 23:59
    dayEndUTC.setMinutes(dayEndUTC.getMinutes() + 1);

    // Base filters using clinic-timezone-aware UTC times
    const dateFilter = {
      gte: dayStartUTC,
      lt: dayEndUTC,
    };

    const queueDateFilter = this.toQueueDate(date);

    // Get scheduled appointments
    const appointments = await this.prisma.appointment.findMany({
      where: {
        clinicId,
        ...(doctorId && { doctorId }),
        startsAt: dateFilter,
      },
      include: {
        patient: { select: { fullName: true, phone: true } },
      },
      orderBy: { startsAt: 'asc' },
    });

    // Get queue entries
    const queueEntries = await this.prisma.queueEntry.findMany({
      where: {
        clinicId,
        ...(doctorId && { doctorId }),
        queueDate: queueDateFilter,
      },
      include: {
        patient: { select: { fullName: true } },
      },
      orderBy: { position: 'asc' },
    });

    // Calculate counts
    const scheduled = appointments.filter((a) => a.status === 'BOOKED').length;
    const noShow = appointments.filter((a) => a.status === 'NO_SHOW').length;
    const queued = queueEntries.filter((e) => e.status === 'QUEUED').length;
    const waiting = queueEntries.filter((e) => e.status === 'WAITING').length;
    const withDoctor = queueEntries.filter((e) => e.status === 'WITH_DOCTOR').length;
    const done = queueEntries.filter((e) => e.status === 'COMPLETED').length;

    // Build scheduled list
    const scheduledList: StaffScheduledItem[] = appointments
      .filter((a) => a.status === 'BOOKED')
      .map((a) => ({
        appointmentId: a.id,
        time: a.startsAt.toISOString(),
        patientName: a.patient.fullName,
        phone: a.patient.phone,
        status: a.status,
      }));

    // Build queued list
    const queuedList: StaffQueuedItem[] = queueEntries
      .filter((e) => e.status === 'QUEUED' || e.status === 'WAITING')
      .map((e) => ({
        queueEntryId: e.id,
        queueNumber: e.position,
        patientName: e.patient.fullName,
        priority: e.priority,
        checkedInAt: e.checkedInAt.toISOString(),
        status: e.status,
      }));

    // Build waiting long list (waiting > 15 min)
    const waitingLong: StaffWaitingLongItem[] = queueEntries
      .filter((e) => e.status === 'WAITING')
      .map((e) => ({
        queueEntryId: e.id,
        queueNumber: e.position,
        patientName: e.patient.fullName,
        minutesWaiting: this.minutesBetween(e.checkedInAt, now),
        priority: e.priority,
      }))
      .filter((e) => e.minutesWaiting > 15)
      .sort((a, b) => b.minutesWaiting - a.minutesWaiting);

    // Build with doctor (first one currently with doctor)
    const withDoctorEntry = queueEntries.find((e) => e.status === 'WITH_DOCTOR');
    const withDoctorItem: StaffWithDoctorItem | null = withDoctorEntry
      ? {
          queueEntryId: withDoctorEntry.id,
          queueNumber: withDoctorEntry.position,
          patientName: withDoctorEntry.patient.fullName,
          startedAt: withDoctorEntry.startedAt?.toISOString() || now.toISOString(),
          elapsedMin: withDoctorEntry.startedAt
            ? this.minutesBetween(withDoctorEntry.startedAt, now)
            : 0,
        }
      : null;

    return {
      date,
      clinic,
      counts: { scheduled, queued, waiting, withDoctor, done, noShow },
      scheduledList,
      queuedList,
      waitingLong,
      withDoctor: withDoctorItem,
    };
  }

  // ============================================
  // Doctor Dashboard
  // ============================================

  async getDoctorDashboard(
    clinicId: string,
    userId: string,
    date: string,
    queryDoctorId?: string,
  ): Promise<DoctorDashboardResponse> {
    const now = new Date();
    const queueDateFilter = this.toQueueDate(date);

    // Get clinic timezone
    const clinic = await this.prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { timezone: true },
    });
    const timezone = clinic?.timezone || 'UTC';

    // Resolve doctorId from user or query param
    let doctorId = queryDoctorId;

    if (!doctorId) {
      // Try to find doctor by userId
      const doctor = await this.prisma.doctor.findFirst({
        where: { clinicId, userId, isActive: true },
      });

      if (doctor) {
        doctorId = doctor.id;
      } else {
        throw new BadRequestException(
          'No doctor profile linked to this user. Please provide doctorId query parameter.',
        );
      }
    }

    // Get doctor info
    const doctor = await this.prisma.doctor.findFirst({
      where: { id: doctorId, clinicId },
      select: { id: true, fullName: true },
    });

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    // Get queue entries for today
    const queueEntries = await this.prisma.queueEntry.findMany({
      where: {
        clinicId,
        doctorId,
        queueDate: queueDateFilter,
      },
      include: {
        patient: { select: { fullName: true } },
      },
      orderBy: { position: 'asc' },
    });

    // Use clinic timezone to calculate date range in UTC
    const dayStartUTC = clinicTimeToUTC(date, '00:00', timezone);
    const dayEndUTC = clinicTimeToUTC(date, '23:59', timezone);
    dayEndUTC.setMinutes(dayEndUTC.getMinutes() + 1);

    // Get appointments for no-show rate
    const appointments = await this.prisma.appointment.findMany({
      where: {
        clinicId,
        doctorId,
        startsAt: {
          gte: dayStartUTC,
          lt: dayEndUTC,
        },
      },
    });

    // Current patient with doctor
    const withDoctorEntry = queueEntries.find((e) => e.status === 'WITH_DOCTOR');
    const nowItem: StaffWithDoctorItem | null = withDoctorEntry
      ? {
          queueEntryId: withDoctorEntry.id,
          queueNumber: withDoctorEntry.position,
          patientName: withDoctorEntry.patient.fullName,
          startedAt: withDoctorEntry.startedAt?.toISOString() || now.toISOString(),
          elapsedMin: withDoctorEntry.startedAt
            ? this.minutesBetween(withDoctorEntry.startedAt, now)
            : 0,
        }
      : null;

    // Waiting next (QUEUED or WAITING status)
    const waitingNext: DoctorWaitingNextItem[] = queueEntries
      .filter((e) => e.status === 'QUEUED' || e.status === 'WAITING')
      .slice(0, 5) // Top 5
      .map((e) => ({
        queueEntryId: e.id,
        queueNumber: e.position,
        patientName: e.patient.fullName,
        minutesWaiting: this.minutesBetween(e.checkedInAt, now),
        priority: e.priority,
      }));

    // Calculate stats
    const completed = queueEntries.filter((e) => e.status === 'COMPLETED');
    const completedDone = queueEntries.filter((e) => e.status === 'COMPLETED' && e.outcome === 'DONE');
    const completedNoShow = queueEntries.filter((e) => e.status === 'COMPLETED' && e.outcome === 'NO_SHOW');
    const waitingEntries = queueEntries.filter(
      (e) => e.status === 'QUEUED' || e.status === 'WAITING',
    );

    // Average wait time (completed DONE entries with startedAt)
    const waitTimes = completedDone
      .filter((e) => e.startedAt)
      .map((e) => this.minutesBetween(e.checkedInAt, e.startedAt!));
    const avgWaitMin = waitTimes.length > 0
      ? Math.round(waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length)
      : 0;

    // Average consult time (completed DONE entries with both startedAt and completedAt)
    const consultTimes = completedDone
      .filter((e) => e.startedAt && e.completedAt)
      .map((e) => this.minutesBetween(e.startedAt!, e.completedAt!));
    const avgConsultMin = consultTimes.length > 0
      ? Math.round(consultTimes.reduce((a, b) => a + b, 0) / consultTimes.length)
      : 0;

    // No-show rate from queue outcomes
    const totalCompleted = completed.length;
    const noShowRate = totalCompleted > 0
      ? Math.round((completedNoShow.length / totalCompleted) * 100)
      : 0;

    return {
      date,
      doctor,
      now: nowItem,
      waitingNext,
      stats: {
        seen: completedDone.length,
        waiting: waitingEntries.length,
        avgWaitMin,
        avgConsultMin,
        noShowRate,
      },
    };
  }

  // ============================================
  // Manager Dashboard
  // ============================================

  async getManagerDashboard(
    clinicId: string,
    from: string,
    to: string,
    doctorId?: string,
  ): Promise<ManagerDashboardResponse> {
    // Validate dates are parseable
    const fromDate = this.parseDate(from);
    const toDate = this.parseDate(to);

    // Validate date range
    if (fromDate > toDate) {
      throw new BadRequestException('from date must be before or equal to to date');
    }

    // Get clinic timezone
    const clinic = await this.prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { timezone: true },
    });
    const timezone = clinic?.timezone || 'UTC';

    // Use clinic timezone to calculate date range in UTC
    const rangeStartUTC = clinicTimeToUTC(from, '00:00', timezone);
    const rangeEndUTC = clinicTimeToUTC(to, '23:59', timezone);
    rangeEndUTC.setMinutes(rangeEndUTC.getMinutes() + 1);

    // Date range filter using clinic-timezone-aware UTC times
    const dateRangeFilter = {
      gte: rangeStartUTC,
      lt: rangeEndUTC,
    };

    // Get all appointments in range
    const appointments = await this.prisma.appointment.findMany({
      where: {
        clinicId,
        ...(doctorId && { doctorId }),
        startsAt: dateRangeFilter,
      },
      include: {
        doctor: { select: { id: true, fullName: true } },
      },
    });

    // Get all queue entries in range
    const queueEntries = await this.prisma.queueEntry.findMany({
      where: {
        clinicId,
        ...(doctorId && { doctorId }),
        queueDate: dateRangeFilter,
      },
      include: {
        doctor: { select: { id: true, fullName: true } },
      },
    });

    // Calculate KPIs
    const totalAppointments = appointments.length;
    const completedAppointments = appointments.filter((a) => a.status === 'COMPLETED').length;
    const walkinEntries = queueEntries.filter((e) => e.source === 'WALKIN').length;
    const totalQueueEntries = queueEntries.length;

    // Calculate no-show from queue outcomes (more accurate than appointment status)
    const completedQueues = queueEntries.filter((e) => e.status === 'COMPLETED');
    const completedDoneQueues = queueEntries.filter((e) => e.status === 'COMPLETED' && e.outcome === 'DONE');
    const noShowQueues = queueEntries.filter((e) => e.status === 'COMPLETED' && e.outcome === 'NO_SHOW');

    const completionPct = totalAppointments > 0
      ? Math.round((completedAppointments / totalAppointments) * 100)
      : 0;

    const noShowRate = completedQueues.length > 0
      ? Math.round((noShowQueues.length / completedQueues.length) * 100)
      : 0;

    const walkinPct = totalQueueEntries > 0
      ? Math.round((walkinEntries / totalQueueEntries) * 100)
      : 0;

    // Calculate average wait and consult times from completed DONE queue entries
    const waitTimes = completedDoneQueues
      .filter((e) => e.startedAt)
      .map((e) => this.minutesBetween(e.checkedInAt, e.startedAt!));
    const avgWaitMin = waitTimes.length > 0
      ? Math.round(waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length)
      : 0;

    const consultTimes = completedDoneQueues
      .filter((e) => e.startedAt && e.completedAt)
      .map((e) => this.minutesBetween(e.startedAt!, e.completedAt!));
    const avgConsultMin = consultTimes.length > 0
      ? Math.round(consultTimes.reduce((a, b) => a + b, 0) / consultTimes.length)
      : 0;

    // Group by doctor using queue entries for accurate outcome tracking
    const doctorMap = new Map<string, {
      doctorId: string;
      doctorName: string;
      total: number;
      completed: number;
      noShows: number;
      waitTimes: number[];
    }>();

    for (const entry of queueEntries) {
      const key = entry.doctorId;
      if (!doctorMap.has(key)) {
        doctorMap.set(key, {
          doctorId: entry.doctor.id,
          doctorName: entry.doctor.fullName,
          total: 0,
          completed: 0,
          noShows: 0,
          waitTimes: [],
        });
      }
      const doc = doctorMap.get(key)!;
      doc.total++;
      if (entry.status === 'COMPLETED' && entry.outcome === 'DONE') {
        doc.completed++;
        if (entry.startedAt) {
          doc.waitTimes.push(this.minutesBetween(entry.checkedInAt, entry.startedAt));
        }
      }
      if (entry.status === 'COMPLETED' && entry.outcome === 'NO_SHOW') {
        doc.noShows++;
      }
    }

    const byDoctor: ManagerByDoctorItem[] = Array.from(doctorMap.values()).map((doc) => ({
      doctorId: doc.doctorId,
      doctorName: doc.doctorName,
      total: doc.total,
      completed: doc.completed,
      noShowRate: doc.total > 0 ? Math.round((doc.noShows / doc.total) * 100) : 0,
      avgWaitMin: doc.waitTimes.length > 0
        ? Math.round(doc.waitTimes.reduce((a, b) => a + b, 0) / doc.waitTimes.length)
        : 0,
      utilizationPct: doc.total > 0 ? Math.round((doc.completed / doc.total) * 100) : 0,
    }));

    // Group by day using queue entries for accurate outcome tracking
    const dayMap = new Map<string, {
      date: string;
      appointments: number;
      completed: number;
      noShows: number;
      waitTimes: number[];
      consultTimes: number[];
    }>();

    for (const entry of queueEntries) {
      const dateKey = entry.queueDate.toISOString().split('T')[0];
      if (!dayMap.has(dateKey)) {
        dayMap.set(dateKey, {
          date: dateKey,
          appointments: 0,
          completed: 0,
          noShows: 0,
          waitTimes: [],
          consultTimes: [],
        });
      }
      const day = dayMap.get(dateKey)!;
      day.appointments++;
      if (entry.status === 'COMPLETED' && entry.outcome === 'DONE') {
        day.completed++;
        if (entry.startedAt) {
          day.waitTimes.push(this.minutesBetween(entry.checkedInAt, entry.startedAt));
        }
        if (entry.startedAt && entry.completedAt) {
          day.consultTimes.push(this.minutesBetween(entry.startedAt, entry.completedAt));
        }
      }
      if (entry.status === 'COMPLETED' && entry.outcome === 'NO_SHOW') {
        day.noShows++;
      }
    }

    const byDay: ManagerByDayItem[] = Array.from(dayMap.values())
      .map((day) => ({
        date: day.date,
        appointments: day.appointments,
        completed: day.completed,
        noShows: day.noShows,
        avgWaitMin: day.waitTimes.length > 0
          ? Math.round(day.waitTimes.reduce((a, b) => a + b, 0) / day.waitTimes.length)
          : 0,
        avgConsultMin: day.consultTimes.length > 0
          ? Math.round(day.consultTimes.reduce((a, b) => a + b, 0) / day.consultTimes.length)
          : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      range: { from, to },
      kpis: {
        totalAppointments,
        completionPct,
        noShowRate,
        avgWaitMin,
        avgConsultMin,
        walkinPct,
      },
      byDoctor,
      byDay,
    };
  }
}
