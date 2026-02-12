import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

// ============================================
// User Context for RBAC filtering
// ============================================

export interface UserContext {
  clinicRole: string;
  clinicUserId: string | null;
  doctorId: string | null; // For CLINIC_DOCTOR users
}

// ============================================
// DTOs for Overview Report
// ============================================

export interface OverviewKpis {
  totalAppointments: number;
  bookedAppointments: number;
  completedAppointments: number;
  cancelledAppointments: number;
  noShowCount: number;
  noShowRate: number;
  avgWaitMin: number;
  avgConsultMin: number;
  walkinPct: number;
}

export interface OverviewByDayItem {
  date: string;
  appointments: number;
  completed: number;
  cancelled: number;
  noShows: number;
  avgWaitMin: number;
  avgConsultMin: number;
  walkins: number;
}

export interface OverviewByDoctorItem {
  doctorId: string;
  doctorName: string;
  appointments: number;
  completed: number;
  noShows: number;
  avgWaitMin: number;
  utilizationPct: number | null;
}

export interface OverviewResponse {
  range: { from: string; to: string };
  kpis: OverviewKpis;
  byDay: OverviewByDayItem[];
  byDoctor: OverviewByDoctorItem[];
}

// ============================================
// DTOs for No-Shows Report
// ============================================

export interface NoShowByDowItem {
  dow: number; // 0 = Sunday, 6 = Saturday
  total: number;
  noShows: number;
  noShowRate: number;
}

export interface NoShowByHourItem {
  hour: number; // 0-23
  total: number;
  noShows: number;
  noShowRate: number;
}

export interface NoShowsResponse {
  range: { from: string; to: string };
  byDow: NoShowByDowItem[];
  byHour: NoShowByHourItem[];
}

// ============================================
// DTOs for Wait Times Report
// ============================================

export interface WaitTimeDistributionItem {
  bucket: string;
  count: number;
}

export interface WaitTimeByDayItem {
  date: string;
  avgWaitMin: number;
  avgConsultMin: number;
}

export interface WaitTimesResponse {
  range: { from: string; to: string };
  avgWaitMin: number;
  avgConsultMin: number;
  distribution: WaitTimeDistributionItem[];
  byDay: WaitTimeByDayItem[];
}

// ============================================
// DTOs for New Reports
// ============================================

export interface PatientReportItem {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  createdAt: string;
  lastVisitDate: string | null;
  totalVisits: number;
}

export interface PatientsReportResponse {
  total: number;
  patients: PatientReportItem[];
}

export interface QueueReportItem {
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
}

export interface QueueReportResponse {
  range: { from: string; to: string };
  total: number;
  entries: QueueReportItem[];
}

export interface AppointmentReportItem {
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
}

export interface AppointmentsReportResponse {
  range: { from: string; to: string };
  total: number;
  appointments: AppointmentReportItem[];
}

export interface DoctorCheckinItem {
  id: string;
  date: string;
  doctorId: string;
  doctorName: string;
  checkInTime: string;
  checkOutTime: string | null;
  hoursWorked: number | null;
}

export interface DoctorCheckinsResponse {
  range: { from: string; to: string };
  total: number;
  checkins: DoctorCheckinItem[];
}

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  // ============================================
  // RBAC Helper Methods
  // ============================================

  // Get allowed doctor IDs based on user role
  private async getAllowedDoctorIds(
    clinicId: string,
    userContext: UserContext,
  ): Promise<string[] | null> {
    // Manager and Platform Admin can see all doctors
    if (userContext.clinicRole === 'CLINIC_MANAGER' || userContext.clinicRole === 'PLATFORM_ADMIN') {
      return null; // null means no restriction
    }

    // Doctor can only see their own data
    if (userContext.clinicRole === 'CLINIC_DOCTOR') {
      if (!userContext.doctorId) {
        return []; // No doctor linked, no data
      }
      return [userContext.doctorId];
    }

    // Staff can only see assigned doctors
    if (userContext.clinicRole === 'CLINIC_STAFF') {
      if (!userContext.clinicUserId) {
        return [];
      }
      const assignments = await this.prisma.staffDoctorAssignment.findMany({
        where: { clinicId, clinicUserId: userContext.clinicUserId },
        select: { doctorId: true },
      });
      return assignments.map((a) => a.doctorId);
    }

    return []; // Default: no access
  }

  // Validate that requested doctorId is within allowed list
  private validateDoctorAccess(
    requestedDoctorId: string | undefined,
    allowedDoctorIds: string[] | null,
  ): void {
    if (!requestedDoctorId) return; // No specific doctor requested
    if (allowedDoctorIds === null) return; // No restrictions
    if (!allowedDoctorIds.includes(requestedDoctorId)) {
      throw new ForbiddenException('You do not have access to this doctor\'s data');
    }
  }

  // Build doctor filter for queries
  private buildDoctorFilter(
    requestedDoctorId: string | undefined,
    allowedDoctorIds: string[] | null,
  ): { doctorId?: string | { in: string[] } } {
    // If specific doctor requested
    if (requestedDoctorId) {
      return { doctorId: requestedDoctorId };
    }
    // If there are restrictions (staff or doctor role)
    if (allowedDoctorIds !== null) {
      if (allowedDoctorIds.length === 0) {
        return { doctorId: { in: [] } }; // Will return empty results
      }
      return { doctorId: { in: allowedDoctorIds } };
    }
    // No filter for managers
    return {};
  }

  // ============================================
  // Helper Methods
  // ============================================

  private parseDate(dateStr: string): Date {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      throw new BadRequestException(`Invalid date format: ${dateStr}`);
    }
    return date;
  }

  private toQueueDate(dateStr: string): Date {
    return new Date(dateStr + 'T00:00:00.000Z');
  }

  private createQueueDateRange(fromStr: string, toStr: string): { gte: Date; lte: Date } {
    return {
      gte: this.toQueueDate(fromStr),
      lte: this.toQueueDate(toStr),
    };
  }

  private minutesBetween(start: Date, end: Date): number {
    return Math.round((end.getTime() - start.getTime()) / 60000);
  }

  // ============================================
  // Overview Report (Updated with RBAC)
  // ============================================

  async getOverview(
    clinicId: string,
    from: string,
    to: string,
    userContext: UserContext,
    doctorId?: string,
  ): Promise<OverviewResponse> {
    const fromDate = this.parseDate(from);
    const toDate = this.parseDate(to);

    if (fromDate > toDate) {
      throw new BadRequestException('from date must be before or equal to to date');
    }

    // RBAC: Get allowed doctors and validate
    const allowedDoctorIds = await this.getAllowedDoctorIds(clinicId, userContext);
    this.validateDoctorAccess(doctorId, allowedDoctorIds);
    const doctorFilter = this.buildDoctorFilter(doctorId, allowedDoctorIds);

    const appointmentDateFilter = {
      gte: new Date(from + 'T00:00:00.000Z'),
      lt: new Date(to + 'T23:59:59.999Z'),
    };
    const queueDateFilter = this.createQueueDateRange(from, to);

    const appointments = await this.prisma.appointment.findMany({
      where: {
        clinicId,
        ...doctorFilter,
        startsAt: appointmentDateFilter,
      },
      include: {
        doctor: { select: { id: true, fullName: true } },
      },
    });

    const queueEntries = await this.prisma.queueEntry.findMany({
      where: {
        clinicId,
        ...doctorFilter,
        queueDate: queueDateFilter,
      },
      include: {
        doctor: { select: { id: true, fullName: true } },
      },
    });

    // Calculate KPIs
    const totalAppointments = appointments.length;
    const bookedAppointments = appointments.filter((a) => a.status === 'BOOKED').length;
    const completedAppointments = appointments.filter((a) => a.status === 'COMPLETED').length;
    const cancelledAppointments = appointments.filter((a) => a.status === 'CANCELLED').length;

    const completedQueues = queueEntries.filter((e) => e.status === 'COMPLETED');
    const noShowQueues = queueEntries.filter(
      (e) => e.status === 'COMPLETED' && e.outcome === 'NO_SHOW',
    );
    const doneQueues = queueEntries.filter(
      (e) => e.status === 'COMPLETED' && (e.outcome === 'DONE' || e.outcome === null),
    );
    const walkinEntries = queueEntries.filter((e) => e.source === 'WALKIN');

    const noShowCount = noShowQueues.length;
    const noShowRate =
      completedQueues.length > 0
        ? Math.round((noShowCount / completedQueues.length) * 100)
        : 0;
    const walkinPct =
      queueEntries.length > 0
        ? Math.round((walkinEntries.length / queueEntries.length) * 100)
        : 0;

    const waitTimes = doneQueues
      .filter((e) => e.startedAt)
      .map((e) => this.minutesBetween(e.checkedInAt, e.startedAt!));
    const avgWaitMin =
      waitTimes.length > 0
        ? Math.round(waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length)
        : 0;

    const consultTimes = doneQueues
      .filter((e) => e.startedAt && e.completedAt)
      .map((e) => this.minutesBetween(e.startedAt!, e.completedAt!));
    const avgConsultMin =
      consultTimes.length > 0
        ? Math.round(consultTimes.reduce((a, b) => a + b, 0) / consultTimes.length)
        : 0;

    // Group by day
    const dayMap = new Map<string, {
      appointments: number;
      completed: number;
      cancelled: number;
      noShows: number;
      waitTimes: number[];
      consultTimes: number[];
      walkins: number;
    }>();

    for (const entry of queueEntries) {
      const dateKey = entry.queueDate.toISOString().split('T')[0];
      if (!dayMap.has(dateKey)) {
        dayMap.set(dateKey, {
          appointments: 0, completed: 0, cancelled: 0, noShows: 0,
          waitTimes: [], consultTimes: [], walkins: 0,
        });
      }
      const day = dayMap.get(dateKey)!;
      day.appointments++;

      if (entry.source === 'WALKIN') day.walkins++;

      if (entry.status === 'COMPLETED' && (entry.outcome === 'DONE' || entry.outcome === null)) {
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
      if (entry.status === 'CANCELLED') {
        day.cancelled++;
      }
    }

    const byDay: OverviewByDayItem[] = Array.from(dayMap.entries())
      .map(([date, data]) => ({
        date,
        appointments: data.appointments,
        completed: data.completed,
        cancelled: data.cancelled,
        noShows: data.noShows,
        avgWaitMin: data.waitTimes.length > 0
          ? Math.round(data.waitTimes.reduce((a, b) => a + b, 0) / data.waitTimes.length)
          : 0,
        avgConsultMin: data.consultTimes.length > 0
          ? Math.round(data.consultTimes.reduce((a, b) => a + b, 0) / data.consultTimes.length)
          : 0,
        walkins: data.walkins,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Group by doctor
    const doctorMap = new Map<string, {
      doctorName: string;
      appointments: number;
      completed: number;
      noShows: number;
      waitTimes: number[];
    }>();

    for (const entry of queueEntries) {
      const key = entry.doctorId;
      if (!doctorMap.has(key)) {
        doctorMap.set(key, {
          doctorName: entry.doctor.fullName,
          appointments: 0, completed: 0, noShows: 0, waitTimes: [],
        });
      }
      const doc = doctorMap.get(key)!;
      doc.appointments++;

      if (entry.status === 'COMPLETED' && (entry.outcome === 'DONE' || entry.outcome === null)) {
        doc.completed++;
        if (entry.startedAt) {
          doc.waitTimes.push(this.minutesBetween(entry.checkedInAt, entry.startedAt));
        }
      }
      if (entry.status === 'COMPLETED' && entry.outcome === 'NO_SHOW') {
        doc.noShows++;
      }
    }

    const byDoctor: OverviewByDoctorItem[] = Array.from(doctorMap.entries()).map(
      ([docId, data]) => ({
        doctorId: docId,
        doctorName: data.doctorName,
        appointments: data.appointments,
        completed: data.completed,
        noShows: data.noShows,
        avgWaitMin: data.waitTimes.length > 0
          ? Math.round(data.waitTimes.reduce((a, b) => a + b, 0) / data.waitTimes.length)
          : 0,
        utilizationPct: data.appointments > 0
          ? Math.round((data.completed / data.appointments) * 100)
          : null,
      }),
    );

    return {
      range: { from, to },
      kpis: {
        totalAppointments, bookedAppointments, completedAppointments, cancelledAppointments,
        noShowCount, noShowRate, avgWaitMin, avgConsultMin, walkinPct,
      },
      byDay,
      byDoctor,
    };
  }

  // ============================================
  // No-Shows Report (Updated with RBAC)
  // ============================================

  async getNoShows(
    clinicId: string,
    from: string,
    to: string,
    userContext: UserContext,
    doctorId?: string,
  ): Promise<NoShowsResponse> {
    const fromDate = this.parseDate(from);
    const toDate = this.parseDate(to);

    if (fromDate > toDate) {
      throw new BadRequestException('from date must be before or equal to to date');
    }

    // RBAC
    const allowedDoctorIds = await this.getAllowedDoctorIds(clinicId, userContext);
    this.validateDoctorAccess(doctorId, allowedDoctorIds);
    const doctorFilter = this.buildDoctorFilter(doctorId, allowedDoctorIds);

    const queueDateFilter = this.createQueueDateRange(from, to);

    const queueEntries = await this.prisma.queueEntry.findMany({
      where: {
        clinicId,
        ...doctorFilter,
        queueDate: queueDateFilter,
        status: 'COMPLETED',
      },
    });

    const dowMap = new Map<number, { total: number; noShows: number }>();
    for (let i = 0; i < 7; i++) {
      dowMap.set(i, { total: 0, noShows: 0 });
    }

    const hourMap = new Map<number, { total: number; noShows: number }>();
    for (let i = 0; i < 24; i++) {
      hourMap.set(i, { total: 0, noShows: 0 });
    }

    for (const entry of queueEntries) {
      const dow = entry.checkedInAt.getDay();
      const hour = entry.checkedInAt.getHours();

      const dowStats = dowMap.get(dow)!;
      dowStats.total++;
      if (entry.outcome === 'NO_SHOW') dowStats.noShows++;

      const hourStats = hourMap.get(hour)!;
      hourStats.total++;
      if (entry.outcome === 'NO_SHOW') hourStats.noShows++;
    }

    const byDow: NoShowByDowItem[] = Array.from(dowMap.entries()).map(([dow, data]) => ({
      dow,
      total: data.total,
      noShows: data.noShows,
      noShowRate: data.total > 0 ? Math.round((data.noShows / data.total) * 100) : 0,
    }));

    const byHour: NoShowByHourItem[] = Array.from(hourMap.entries())
      .filter(([, data]) => data.total > 0)
      .map(([hour, data]) => ({
        hour,
        total: data.total,
        noShows: data.noShows,
        noShowRate: data.total > 0 ? Math.round((data.noShows / data.total) * 100) : 0,
      }));

    return { range: { from, to }, byDow, byHour };
  }

  // ============================================
  // Wait Times Report (Updated with RBAC)
  // ============================================

  async getWaitTimes(
    clinicId: string,
    from: string,
    to: string,
    userContext: UserContext,
    doctorId?: string,
  ): Promise<WaitTimesResponse> {
    const fromDate = this.parseDate(from);
    const toDate = this.parseDate(to);

    if (fromDate > toDate) {
      throw new BadRequestException('from date must be before or equal to to date');
    }

    // RBAC
    const allowedDoctorIds = await this.getAllowedDoctorIds(clinicId, userContext);
    this.validateDoctorAccess(doctorId, allowedDoctorIds);
    const doctorFilter = this.buildDoctorFilter(doctorId, allowedDoctorIds);

    const queueDateFilter = this.createQueueDateRange(from, to);

    const queueEntries = await this.prisma.queueEntry.findMany({
      where: {
        clinicId,
        ...doctorFilter,
        queueDate: queueDateFilter,
        status: 'COMPLETED',
        startedAt: { not: null },
        OR: [{ outcome: 'DONE' }, { outcome: null }],
      },
    });

    const waitTimes = queueEntries.map((e) =>
      this.minutesBetween(e.checkedInAt, e.startedAt!),
    );
    const avgWaitMin = waitTimes.length > 0
      ? Math.round(waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length)
      : 0;

    const consultTimes = queueEntries
      .filter((e) => e.completedAt)
      .map((e) => this.minutesBetween(e.startedAt!, e.completedAt!));
    const avgConsultMin = consultTimes.length > 0
      ? Math.round(consultTimes.reduce((a, b) => a + b, 0) / consultTimes.length)
      : 0;

    const buckets = [
      { label: '0-5', min: 0, max: 5 },
      { label: '6-10', min: 6, max: 10 },
      { label: '11-20', min: 11, max: 20 },
      { label: '21-30', min: 21, max: 30 },
      { label: '31-45', min: 31, max: 45 },
      { label: '46-60', min: 46, max: 60 },
      { label: '60+', min: 61, max: Infinity },
    ];

    const distribution: WaitTimeDistributionItem[] = buckets.map((bucket) => ({
      bucket: bucket.label,
      count: waitTimes.filter((t) => t >= bucket.min && t <= bucket.max).length,
    }));

    const dayMap = new Map<string, { waitTimes: number[]; consultTimes: number[] }>();

    for (const entry of queueEntries) {
      const dateKey = entry.queueDate.toISOString().split('T')[0];
      if (!dayMap.has(dateKey)) {
        dayMap.set(dateKey, { waitTimes: [], consultTimes: [] });
      }
      const day = dayMap.get(dateKey)!;
      day.waitTimes.push(this.minutesBetween(entry.checkedInAt, entry.startedAt!));
      if (entry.completedAt) {
        day.consultTimes.push(this.minutesBetween(entry.startedAt!, entry.completedAt));
      }
    }

    const byDay: WaitTimeByDayItem[] = Array.from(dayMap.entries())
      .map(([date, data]) => ({
        date,
        avgWaitMin: data.waitTimes.length > 0
          ? Math.round(data.waitTimes.reduce((a, b) => a + b, 0) / data.waitTimes.length)
          : 0,
        avgConsultMin: data.consultTimes.length > 0
          ? Math.round(data.consultTimes.reduce((a, b) => a + b, 0) / data.consultTimes.length)
          : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return { range: { from, to }, avgWaitMin, avgConsultMin, distribution, byDay };
  }

  // ============================================
  // Patients Report (NEW)
  // ============================================

  async getPatients(
    clinicId: string,
    userContext: UserContext,
    from?: string,
    to?: string,
    status?: string,
    limit: number = 100,
    offset: number = 0,
  ): Promise<PatientsReportResponse> {
    // RBAC: Get allowed doctors
    const allowedDoctorIds = await this.getAllowedDoctorIds(clinicId, userContext);

    // Build where clause
    const where: any = { clinicId };

    // For staff/doctor, filter patients by queue entries for allowed doctors
    if (allowedDoctorIds !== null && allowedDoctorIds.length > 0) {
      const patientIds = await this.prisma.queueEntry.findMany({
        where: { clinicId, doctorId: { in: allowedDoctorIds } },
        select: { patientId: true },
        distinct: ['patientId'],
      });
      where.id = { in: patientIds.map((p) => p.patientId) };
    } else if (allowedDoctorIds !== null && allowedDoctorIds.length === 0) {
      return { total: 0, patients: [] };
    }

    // Date filter based on patient creation or last visit
    if (from || to) {
      const dateFilter: any = {};
      if (from) dateFilter.gte = new Date(from + 'T00:00:00.000Z');
      if (to) dateFilter.lte = new Date(to + 'T23:59:59.999Z');
      where.createdAt = dateFilter;
    }

    const total = await this.prisma.patient.count({ where });

    const patients = await this.prisma.patient.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
      include: {
        queueEntries: {
          select: { queueDate: true },
          orderBy: { queueDate: 'desc' },
          take: 1,
        },
        _count: { select: { queueEntries: true } },
      },
    });

    const patientList: PatientReportItem[] = patients.map((p) => ({
      id: p.id,
      fullName: p.fullName,
      phone: p.phone,
      email: p.email,
      createdAt: p.createdAt.toISOString(),
      lastVisitDate: p.queueEntries[0]?.queueDate.toISOString().split('T')[0] || null,
      totalVisits: p._count.queueEntries,
    }));

    return { total, patients: patientList };
  }

  // ============================================
  // Queue Report (NEW)
  // ============================================

  async getQueueReport(
    clinicId: string,
    from: string,
    to: string,
    userContext: UserContext,
    doctorId?: string,
    status?: string,
  ): Promise<QueueReportResponse> {
    const fromDate = this.parseDate(from);
    const toDate = this.parseDate(to);

    if (fromDate > toDate) {
      throw new BadRequestException('from date must be before or equal to to date');
    }

    // RBAC
    const allowedDoctorIds = await this.getAllowedDoctorIds(clinicId, userContext);
    this.validateDoctorAccess(doctorId, allowedDoctorIds);
    const doctorFilter = this.buildDoctorFilter(doctorId, allowedDoctorIds);

    const queueDateFilter = this.createQueueDateRange(from, to);

    const where: any = {
      clinicId,
      ...doctorFilter,
      queueDate: queueDateFilter,
    };

    if (status) {
      where.status = status;
    }

    const entries = await this.prisma.queueEntry.findMany({
      where,
      orderBy: [{ queueDate: 'desc' }, { position: 'asc' }],
      include: {
        patient: { select: { fullName: true, phone: true } },
        doctor: { select: { fullName: true } },
      },
    });

    const queueItems: QueueReportItem[] = entries.map((e) => ({
      id: e.id,
      date: e.queueDate.toISOString().split('T')[0],
      position: e.position,
      patientName: e.patient.fullName,
      patientPhone: e.patient.phone,
      doctorName: e.doctor.fullName,
      doctorId: e.doctorId,
      status: e.status,
      outcome: e.outcome,
      source: e.source,
      priority: e.priority,
      checkedInAt: e.checkedInAt.toISOString(),
      startedAt: e.startedAt?.toISOString() || null,
      completedAt: e.completedAt?.toISOString() || null,
      waitMinutes: e.startedAt ? this.minutesBetween(e.checkedInAt, e.startedAt) : null,
      consultMinutes: e.startedAt && e.completedAt
        ? this.minutesBetween(e.startedAt, e.completedAt)
        : null,
    }));

    return {
      range: { from, to },
      total: queueItems.length,
      entries: queueItems,
    };
  }

  // ============================================
  // Appointments Report (NEW)
  // ============================================

  async getAppointments(
    clinicId: string,
    from: string,
    to: string,
    userContext: UserContext,
    doctorId?: string,
    status?: string,
  ): Promise<AppointmentsReportResponse> {
    const fromDate = this.parseDate(from);
    const toDate = this.parseDate(to);

    if (fromDate > toDate) {
      throw new BadRequestException('from date must be before or equal to to date');
    }

    // RBAC
    const allowedDoctorIds = await this.getAllowedDoctorIds(clinicId, userContext);
    this.validateDoctorAccess(doctorId, allowedDoctorIds);
    const doctorFilter = this.buildDoctorFilter(doctorId, allowedDoctorIds);

    const appointmentDateFilter = {
      gte: new Date(from + 'T00:00:00.000Z'),
      lt: new Date(to + 'T23:59:59.999Z'),
    };

    const where: any = {
      clinicId,
      ...doctorFilter,
      startsAt: appointmentDateFilter,
    };

    if (status) {
      where.status = status;
    }

    const appointments = await this.prisma.appointment.findMany({
      where,
      orderBy: { startsAt: 'desc' },
      include: {
        patient: { select: { fullName: true, phone: true } },
        doctor: { select: { fullName: true } },
      },
    });

    const appointmentItems: AppointmentReportItem[] = appointments.map((a) => ({
      id: a.id,
      date: a.startsAt.toISOString().split('T')[0],
      time: a.startsAt.toISOString(),
      patientName: a.patient.fullName,
      patientPhone: a.patient.phone,
      doctorName: a.doctor.fullName,
      doctorId: a.doctorId,
      status: a.status,
      reason: a.reason,
      createdAt: a.createdAt.toISOString(),
    }));

    return {
      range: { from, to },
      total: appointmentItems.length,
      appointments: appointmentItems,
    };
  }

  // ============================================
  // Doctor Check-ins Report (NEW)
  // ============================================

  async getDoctorCheckins(
    clinicId: string,
    from: string,
    to: string,
    userContext: UserContext,
    doctorId?: string,
  ): Promise<DoctorCheckinsResponse> {
    const fromDate = this.parseDate(from);
    const toDate = this.parseDate(to);

    if (fromDate > toDate) {
      throw new BadRequestException('from date must be before or equal to to date');
    }

    // RBAC
    const allowedDoctorIds = await this.getAllowedDoctorIds(clinicId, userContext);
    this.validateDoctorAccess(doctorId, allowedDoctorIds);
    const doctorFilter = this.buildDoctorFilter(doctorId, allowedDoctorIds);

    const dateFilter = this.createQueueDateRange(from, to);

    const checkins = await this.prisma.doctorDailyCheckIn.findMany({
      where: {
        clinicId,
        ...doctorFilter,
        checkInDate: dateFilter,
      },
      orderBy: [{ checkInDate: 'desc' }, { checkInTime: 'desc' }],
      include: {
        doctor: { select: { fullName: true } },
      },
    });

    const checkinItems: DoctorCheckinItem[] = checkins.map((c) => ({
      id: c.id,
      date: c.checkInDate.toISOString().split('T')[0],
      doctorId: c.doctorId,
      doctorName: c.doctor.fullName,
      checkInTime: c.checkInTime.toISOString(),
      checkOutTime: c.checkOutTime?.toISOString() || null,
      hoursWorked: c.checkOutTime
        ? Math.round((c.checkOutTime.getTime() - c.checkInTime.getTime()) / 3600000 * 10) / 10
        : null,
    }));

    return {
      range: { from, to },
      total: checkinItems.length,
      checkins: checkinItems,
    };
  }
}
