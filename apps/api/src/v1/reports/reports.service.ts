import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

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

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  // Helper to parse and validate date
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

  // Helper to create date range filter for @db.Date fields
  // For @db.Date, we need to use UTC midnight dates for proper comparison
  private createQueueDateRange(fromStr: string, toStr: string): { gte: Date; lte: Date } {
    return {
      gte: this.toQueueDate(fromStr),
      lte: this.toQueueDate(toStr),
    };
  }

  // Helper to calculate minutes between two dates
  private minutesBetween(start: Date, end: Date): number {
    return Math.round((end.getTime() - start.getTime()) / 60000);
  }

  // ============================================
  // Overview Report
  // ============================================

  async getOverview(
    clinicId: string,
    from: string,
    to: string,
    doctorId?: string,
  ): Promise<OverviewResponse> {
    const fromDate = this.parseDate(from);
    const toDate = this.parseDate(to);

    if (fromDate > toDate) {
      throw new BadRequestException('from date must be before or equal to to date');
    }

    // Date range filter for timestamp fields (appointments.startsAt)
    const appointmentDateFilter = {
      gte: new Date(from + 'T00:00:00.000Z'),
      lt: new Date(to + 'T23:59:59.999Z'),
    };

    // Date range filter for @db.Date fields (queueEntry.queueDate)
    // Uses UTC midnight dates for proper comparison
    const queueDateFilter = this.createQueueDateRange(from, to);

    // Get appointments
    const appointments = await this.prisma.appointment.findMany({
      where: {
        clinicId,
        ...(doctorId && { doctorId }),
        startsAt: appointmentDateFilter,
      },
      include: {
        doctor: { select: { id: true, fullName: true } },
      },
    });

    // Get queue entries
    const queueEntries = await this.prisma.queueEntry.findMany({
      where: {
        clinicId,
        ...(doctorId && { doctorId }),
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

    // No-show from queue outcomes (preferred)
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

    // Average wait and consult times from DONE queue entries
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
    const dayMap = new Map<
      string,
      {
        appointments: number;
        completed: number;
        cancelled: number;
        noShows: number;
        waitTimes: number[];
        consultTimes: number[];
        walkins: number;
      }
    >();

    for (const entry of queueEntries) {
      const dateKey = entry.queueDate.toISOString().split('T')[0];
      if (!dayMap.has(dateKey)) {
        dayMap.set(dateKey, {
          appointments: 0,
          completed: 0,
          cancelled: 0,
          noShows: 0,
          waitTimes: [],
          consultTimes: [],
          walkins: 0,
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
        avgWaitMin:
          data.waitTimes.length > 0
            ? Math.round(data.waitTimes.reduce((a, b) => a + b, 0) / data.waitTimes.length)
            : 0,
        avgConsultMin:
          data.consultTimes.length > 0
            ? Math.round(data.consultTimes.reduce((a, b) => a + b, 0) / data.consultTimes.length)
            : 0,
        walkins: data.walkins,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Group by doctor
    const doctorMap = new Map<
      string,
      {
        doctorName: string;
        appointments: number;
        completed: number;
        noShows: number;
        waitTimes: number[];
      }
    >();

    for (const entry of queueEntries) {
      const key = entry.doctorId;
      if (!doctorMap.has(key)) {
        doctorMap.set(key, {
          doctorName: entry.doctor.fullName,
          appointments: 0,
          completed: 0,
          noShows: 0,
          waitTimes: [],
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
      ([doctorId, data]) => ({
        doctorId,
        doctorName: data.doctorName,
        appointments: data.appointments,
        completed: data.completed,
        noShows: data.noShows,
        avgWaitMin:
          data.waitTimes.length > 0
            ? Math.round(data.waitTimes.reduce((a, b) => a + b, 0) / data.waitTimes.length)
            : 0,
        utilizationPct:
          data.appointments > 0
            ? Math.round((data.completed / data.appointments) * 100)
            : null,
      }),
    );

    return {
      range: { from, to },
      kpis: {
        totalAppointments,
        bookedAppointments,
        completedAppointments,
        cancelledAppointments,
        noShowCount,
        noShowRate,
        avgWaitMin,
        avgConsultMin,
        walkinPct,
      },
      byDay,
      byDoctor,
    };
  }

  // ============================================
  // No-Shows Report
  // ============================================

  async getNoShows(
    clinicId: string,
    from: string,
    to: string,
    doctorId?: string,
  ): Promise<NoShowsResponse> {
    const fromDate = this.parseDate(from);
    const toDate = this.parseDate(to);

    if (fromDate > toDate) {
      throw new BadRequestException('from date must be before or equal to to date');
    }

    // Date range filter for @db.Date fields (queueEntry.queueDate)
    // Uses UTC midnight dates for proper comparison
    const queueDateFilter = this.createQueueDateRange(from, to);

    // Get completed queue entries for analysis
    const queueEntries = await this.prisma.queueEntry.findMany({
      where: {
        clinicId,
        ...(doctorId && { doctorId }),
        queueDate: queueDateFilter,
        status: 'COMPLETED',
      },
    });

    // Group by day of week
    const dowMap = new Map<number, { total: number; noShows: number }>();
    for (let i = 0; i < 7; i++) {
      dowMap.set(i, { total: 0, noShows: 0 });
    }

    // Group by hour
    const hourMap = new Map<number, { total: number; noShows: number }>();
    for (let i = 0; i < 24; i++) {
      hourMap.set(i, { total: 0, noShows: 0 });
    }

    for (const entry of queueEntries) {
      const dow = entry.checkedInAt.getDay(); // 0 = Sunday
      const hour = entry.checkedInAt.getHours();

      // Update DOW stats
      const dowStats = dowMap.get(dow)!;
      dowStats.total++;
      if (entry.outcome === 'NO_SHOW') {
        dowStats.noShows++;
      }

      // Update hour stats
      const hourStats = hourMap.get(hour)!;
      hourStats.total++;
      if (entry.outcome === 'NO_SHOW') {
        hourStats.noShows++;
      }
    }

    const byDow: NoShowByDowItem[] = Array.from(dowMap.entries()).map(([dow, data]) => ({
      dow,
      total: data.total,
      noShows: data.noShows,
      noShowRate: data.total > 0 ? Math.round((data.noShows / data.total) * 100) : 0,
    }));

    const byHour: NoShowByHourItem[] = Array.from(hourMap.entries())
      .filter(([, data]) => data.total > 0) // Only include hours with data
      .map(([hour, data]) => ({
        hour,
        total: data.total,
        noShows: data.noShows,
        noShowRate: data.total > 0 ? Math.round((data.noShows / data.total) * 100) : 0,
      }));

    return {
      range: { from, to },
      byDow,
      byHour,
    };
  }

  // ============================================
  // Wait Times Report
  // ============================================

  async getWaitTimes(
    clinicId: string,
    from: string,
    to: string,
    doctorId?: string,
  ): Promise<WaitTimesResponse> {
    const fromDate = this.parseDate(from);
    const toDate = this.parseDate(to);

    if (fromDate > toDate) {
      throw new BadRequestException('from date must be before or equal to to date');
    }

    // Date range filter for @db.Date fields (queueEntry.queueDate)
    // Uses UTC midnight dates for proper comparison
    const queueDateFilter = this.createQueueDateRange(from, to);

    // Get completed DONE queue entries with timing data
    const queueEntries = await this.prisma.queueEntry.findMany({
      where: {
        clinicId,
        ...(doctorId && { doctorId }),
        queueDate: queueDateFilter,
        status: 'COMPLETED',
        startedAt: { not: null },
        OR: [{ outcome: 'DONE' }, { outcome: null }], // DONE or legacy null
      },
    });

    // Calculate overall averages
    const waitTimes = queueEntries.map((e) =>
      this.minutesBetween(e.checkedInAt, e.startedAt!),
    );
    const avgWaitMin =
      waitTimes.length > 0
        ? Math.round(waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length)
        : 0;

    const consultTimes = queueEntries
      .filter((e) => e.completedAt)
      .map((e) => this.minutesBetween(e.startedAt!, e.completedAt!));
    const avgConsultMin =
      consultTimes.length > 0
        ? Math.round(consultTimes.reduce((a, b) => a + b, 0) / consultTimes.length)
        : 0;

    // Build wait time distribution
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

    // Group by day
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
        avgWaitMin:
          data.waitTimes.length > 0
            ? Math.round(data.waitTimes.reduce((a, b) => a + b, 0) / data.waitTimes.length)
            : 0,
        avgConsultMin:
          data.consultTimes.length > 0
            ? Math.round(data.consultTimes.reduce((a, b) => a + b, 0) / data.consultTimes.length)
            : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      range: { from, to },
      avgWaitMin,
      avgConsultMin,
      distribution,
      byDay,
    };
  }
}
