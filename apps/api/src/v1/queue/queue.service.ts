import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { PatientsService } from '../patients/patients.service';
import { TimezoneService } from '../../common/timezone.service';
import { randomBytes } from 'crypto';

@Injectable()
export class QueueService {
  constructor(
    private prisma: PrismaService,
    private patientsService: PatientsService,
    private timezoneService: TimezoneService,
  ) {}

  // Auto-cancel stale queue entries from previous days
  // Called automatically when listing queue
  private async cancelStaleQueueEntries(clinicId: string, currentDate: Date): Promise<number> {
    // Find and cancel all queue entries from previous days that are still in active status
    const result = await this.prisma.queueEntry.updateMany({
      where: {
        clinicId,
        queueDate: { lt: currentDate },
        status: { in: ['QUEUED', 'WAITING', 'WITH_DOCTOR'] },
      },
      data: {
        status: 'COMPLETED',
        outcome: 'NO_SHOW',
        completedAt: new Date(),
      },
    });

    // Also update any linked appointments to NO_SHOW status
    if (result.count > 0) {
      // Find appointments that were linked to stale queue entries
      const staleEntries = await this.prisma.queueEntry.findMany({
        where: {
          clinicId,
          queueDate: { lt: currentDate },
          source: 'APPOINTMENT',
          outcome: 'NO_SHOW',
        },
        select: { id: true },
      });

      // Get appointment IDs from tokens
      const tokens = await this.prisma.patientPublicToken.findMany({
        where: {
          queueEntryId: { in: staleEntries.map(e => e.id) },
          appointmentId: { not: null },
        },
        select: { appointmentId: true },
      });

      const appointmentIds = tokens
        .map(t => t.appointmentId)
        .filter((id): id is string => id !== null);

      if (appointmentIds.length > 0) {
        await this.prisma.appointment.updateMany({
          where: {
            id: { in: appointmentIds },
            status: 'CHECKED_IN',
          },
          data: { status: 'NO_SHOW' },
        });
      }
    }

    return result.count;
  }

  // List queue entries for date/doctor
  async listQueue(
    clinicId: string,
    filters: { date?: string; doctorId?: string },
  ) {
    // Get clinic timezone
    const clinic = await this.prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { timezone: true },
    });
    const timezone = clinic?.timezone || 'UTC';

    // For @db.Date fields, we must use UTC midnight dates
    // PostgreSQL DATE type stores only the date portion, compared at UTC midnight
    const now = new Date();
    const todayStr = now.toLocaleDateString('en-CA', { timeZone: timezone }); // YYYY-MM-DD format
    const todayDate = new Date(todayStr + 'T00:00:00.000Z'); // Today in clinic timezone as UTC midnight

    let queueDate: Date;
    if (filters.date) {
      // Date string provided (e.g., '2026-02-10') - use UTC midnight
      queueDate = new Date(filters.date + 'T00:00:00.000Z');
    } else {
      // No date - use today in clinic timezone
      queueDate = todayDate;
    }

    // Auto-cancel stale queue entries from previous days
    // Only do this when querying for today's queue (not historical queries)
    if (queueDate.getTime() === todayDate.getTime()) {
      await this.cancelStaleQueueEntries(clinicId, todayDate);
    }

    const where: any = { clinicId, queueDate };

    if (filters.doctorId) {
      where.doctorId = filters.doctorId;
    }

    return this.prisma.queueEntry.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { position: 'asc' }],
      include: {
        patient: { select: { id: true, fullName: true, phone: true } },
        doctor: { select: { id: true, fullName: true } },
      },
    });
  }

  // Get single queue entry
  async getQueueEntry(clinicId: string, queueId: string) {
    const entry = await this.prisma.queueEntry.findFirst({
      where: { id: queueId, clinicId },
      include: {
        patient: { select: { id: true, fullName: true, phone: true } },
        doctor: { select: { id: true, fullName: true } },
      },
    });

    if (!entry) {
      throw new NotFoundException('Queue entry not found');
    }

    return entry;
  }

  // Create walk-in queue entry
  async createWalkin(
    clinicId: string,
    data: {
      doctorId: string;
      patientName: string;
      patientPhone: string;
      priority?: 'NORMAL' | 'URGENT' | 'EMERGENCY';
      reason?: string;
    },
  ) {
    // Verify doctor exists and is active
    const doctor = await this.prisma.doctor.findFirst({
      where: { id: data.doctorId, clinicId, isActive: true },
    });

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    // Find or create patient
    const patient = await this.patientsService.findOrCreatePatient(clinicId, {
      fullName: data.patientName,
      phone: data.patientPhone,
    });

    // Get clinic timezone and today's date as UTC midnight
    // For @db.Date fields, we must use UTC midnight dates
    const clinic = await this.prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { timezone: true },
    });
    const timezone = clinic?.timezone || 'UTC';
    const now = new Date();
    const todayStr = now.toLocaleDateString('en-CA', { timeZone: timezone }); // YYYY-MM-DD format
    const today = new Date(todayStr + 'T00:00:00.000Z'); // UTC midnight

    // Get next position in queue for this doctor today
    const lastEntry = await this.prisma.queueEntry.findFirst({
      where: {
        clinicId,
        doctorId: data.doctorId,
        queueDate: today,
      },
      orderBy: { position: 'desc' },
    });

    const position = (lastEntry?.position || 0) + 1;

    // Determine effective position based on priority
    // EMERGENCY goes to position 1, URGENT goes after emergency, NORMAL at end
    let effectivePosition = position;
    if (data.priority === 'EMERGENCY') {
      effectivePosition = 1;
      // Shift all others down
      await this.prisma.queueEntry.updateMany({
        where: {
          clinicId,
          doctorId: data.doctorId,
          queueDate: today,
          status: { in: ['QUEUED', 'WAITING'] },
        },
        data: { position: { increment: 1 } },
      });
    } else if (data.priority === 'URGENT') {
      // Find position after emergencies
      const lastEmergency = await this.prisma.queueEntry.findFirst({
        where: {
          clinicId,
          doctorId: data.doctorId,
          queueDate: today,
          priority: 'EMERGENCY',
        },
        orderBy: { position: 'desc' },
      });
      effectivePosition = (lastEmergency?.position || 0) + 1;
      // Shift normal entries down
      await this.prisma.queueEntry.updateMany({
        where: {
          clinicId,
          doctorId: data.doctorId,
          queueDate: today,
          priority: 'NORMAL',
          status: { in: ['QUEUED', 'WAITING'] },
        },
        data: { position: { increment: 1 } },
      });
    }

    return this.prisma.queueEntry.create({
      data: {
        clinicId,
        doctorId: data.doctorId,
        patientId: patient.id,
        queueDate: today,
        position: effectivePosition,
        priority: data.priority || 'NORMAL',
        status: 'QUEUED',
        source: 'WALKIN',
        reason: data.reason,
      },
      include: {
        patient: { select: { id: true, fullName: true, phone: true } },
        doctor: { select: { id: true, fullName: true } },
      },
    });
  }

  // Update queue status
  async updateStatus(
    clinicId: string,
    queueId: string,
    data: {
      status: 'QUEUED' | 'WAITING' | 'WITH_DOCTOR' | 'COMPLETED' | 'CANCELLED';
      outcome?: 'DONE' | 'NO_SHOW';
    },
  ) {
    const entry = await this.prisma.queueEntry.findFirst({
      where: { id: queueId, clinicId },
    });

    if (!entry) {
      throw new NotFoundException('Queue entry not found');
    }

    const updateData: any = { status: data.status };

    // Set timestamps based on status
    if (data.status === 'WITH_DOCTOR' && !entry.startedAt) {
      updateData.startedAt = new Date();
    }
    if (data.status === 'COMPLETED' && !entry.completedAt) {
      updateData.completedAt = new Date();
      if (!entry.startedAt) {
        updateData.startedAt = new Date();
      }
      // Set outcome when completing (default to DONE if not specified)
      updateData.outcome = data.outcome || 'DONE';
    }

    // Allow setting outcome explicitly even if already completed
    if (data.outcome && data.status === 'COMPLETED') {
      updateData.outcome = data.outcome;
    }

    const updatedEntry = await this.prisma.queueEntry.update({
      where: { id: queueId },
      data: updateData,
      include: {
        patient: { select: { id: true, fullName: true, phone: true } },
        doctor: { select: { id: true, fullName: true } },
      },
    });

    // If completing, update the linked appointment status
    if (data.status === 'COMPLETED') {
      // Find linked appointment through PatientPublicToken
      const token = await this.prisma.patientPublicToken.findFirst({
        where: { queueEntryId: queueId, appointmentId: { not: null } },
      });

      if (token?.appointmentId) {
        // Set appointment status based on queue outcome
        const appointmentStatus = data.outcome === 'NO_SHOW' ? 'NO_SHOW' : 'COMPLETED';
        await this.prisma.appointment.update({
          where: { id: token.appointmentId },
          data: { status: appointmentStatus },
        });
      }
    }

    return updatedEntry;
  }

  // Issue public token for queue entry
  async issueToken(
    clinicId: string,
    queueId: string,
    ttlMinutes: number = 480, // Default 8 hours
  ) {
    const entry = await this.prisma.queueEntry.findFirst({
      where: { id: queueId, clinicId },
      include: { patient: true },
    });

    if (!entry) {
      throw new NotFoundException('Queue entry not found');
    }

    const token = randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

    const publicToken = await this.prisma.patientPublicToken.create({
      data: {
        clinicId,
        token,
        queueEntryId: queueId,
        patientId: entry.patientId,
        expiresAt,
      },
    });

    return {
      token: publicToken.token,
      urlPath: `/p/${publicToken.token}`,
      expiresAt: publicToken.expiresAt,
    };
  }

  // Get queue position by token (public endpoint)
  async getQueueByToken(token: string) {
    const publicToken = await this.prisma.patientPublicToken.findUnique({
      where: { token },
      include: {
        queueEntry: {
          include: {
            doctor: { select: { fullName: true } },
            clinic: { select: { name: true } },
          },
        },
      },
    });

    if (!publicToken) {
      throw new NotFoundException('Invalid token');
    }

    if (publicToken.expiresAt < new Date()) {
      throw new BadRequestException('Token expired');
    }

    if (!publicToken.queueEntry) {
      throw new NotFoundException('Queue entry not found');
    }

    const entry = publicToken.queueEntry;

    // Count how many people are ahead
    const ahead = await this.prisma.queueEntry.count({
      where: {
        clinicId: entry.clinicId,
        doctorId: entry.doctorId,
        queueDate: entry.queueDate,
        status: { in: ['QUEUED', 'WAITING'] },
        position: { lt: entry.position },
      },
    });

    return {
      clinicName: entry.clinic.name,
      doctorName: entry.doctor.fullName,
      position: entry.position,
      status: entry.status,
      peopleAhead: ahead,
      checkedInAt: entry.checkedInAt,
    };
  }
}
