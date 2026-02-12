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
      // Shift all non-emergency entries at or after this position
      await this.prisma.queueEntry.updateMany({
        where: {
          clinicId,
          doctorId: data.doctorId,
          queueDate: today,
          priority: { not: 'EMERGENCY' },
          position: { gte: effectivePosition },
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
            doctor: { select: { fullName: true, appointmentDurationMin: true } },
            clinic: { select: { name: true, timezone: true } },
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

    // Count how many people are ahead (in QUEUED or WAITING status)
    const ahead = await this.prisma.queueEntry.count({
      where: {
        clinicId: entry.clinicId,
        doctorId: entry.doctorId,
        queueDate: entry.queueDate,
        status: { in: ['QUEUED', 'WAITING'] },
        position: { lt: entry.position },
      },
    });

    // Check if doctor is currently seeing a patient (WITH_DOCTOR status)
    const patientWithDoctor = await this.prisma.queueEntry.findFirst({
      where: {
        clinicId: entry.clinicId,
        doctorId: entry.doctorId,
        queueDate: entry.queueDate,
        status: 'WITH_DOCTOR',
      },
      select: { startedAt: true },
    });

    const isDoctorBusy = !!patientWithDoctor;
    const consultationDurationMin = entry.doctor.appointmentDurationMin || 15;

    // Calculate estimated wait time (only meaningful when doctor has started seeing patients)
    // Formula: (patients ahead * consultation duration) + remaining time for current patient
    let estimatedWaitMinutes: number | null = null;
    if (entry.status !== 'COMPLETED' && entry.status !== 'CANCELLED') {
      if (isDoctorBusy && patientWithDoctor?.startedAt) {
        // Calculate how long current patient has been with doctor
        const elapsedMs = Date.now() - new Date(patientWithDoctor.startedAt).getTime();
        const elapsedMin = Math.floor(elapsedMs / 60000);
        const remainingForCurrent = Math.max(0, consultationDurationMin - elapsedMin);
        estimatedWaitMinutes = remainingForCurrent + (ahead * consultationDurationMin);
      } else if (ahead > 0) {
        // Doctor not currently busy but there are people ahead
        estimatedWaitMinutes = ahead * consultationDurationMin;
      } else {
        // No one ahead
        estimatedWaitMinutes = 0;
      }
    }

    return {
      clinicName: entry.clinic.name,
      doctorName: entry.doctor.fullName,
      position: entry.position,
      status: entry.status,
      source: entry.source, // WALKIN or APPOINTMENT
      peopleAhead: ahead,
      checkedInAt: entry.checkedInAt,
      isDoctorBusy,
      consultationDurationMin,
      estimatedWaitMinutes,
    };
  }

  // Get TV display data for waiting area (public endpoint)
  async getTvDisplayData(clinicId: string) {
    // Verify clinic exists
    const clinic = await this.prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { id: true, name: true, timezone: true },
    });

    if (!clinic) {
      throw new NotFoundException('Clinic not found');
    }

    const timezone = clinic.timezone || 'UTC';

    // Get today's date in clinic timezone
    const now = new Date();
    const todayStr = now.toLocaleDateString('en-CA', { timeZone: timezone });
    const todayDate = new Date(todayStr + 'T00:00:00.000Z');

    // Get all active doctors for this clinic
    const doctors = await this.prisma.doctor.findMany({
      where: { clinicId, isActive: true },
      select: {
        id: true,
        fullName: true,
        appointmentDurationMin: true,
      },
      orderBy: { fullName: 'asc' },
    });

    // Get today's check-ins to determine doctor status
    const todayCheckIns = await this.prisma.doctorDailyCheckIn.findMany({
      where: {
        clinicId,
        checkInDate: todayDate,
        checkOutTime: null, // Only those still checked in
      },
      select: { doctorId: true },
    });

    const checkedInDoctorIds = new Set(todayCheckIns.map(c => c.doctorId));

    // Get all active queue entries for today (QUEUED, WAITING, WITH_DOCTOR)
    const queueEntries = await this.prisma.queueEntry.findMany({
      where: {
        clinicId,
        queueDate: todayDate,
        status: { in: ['QUEUED', 'WAITING', 'WITH_DOCTOR'] },
      },
      include: {
        patient: { select: { fullName: true } },
        doctor: { select: { id: true, fullName: true, appointmentDurationMin: true } },
      },
      orderBy: [{ doctorId: 'asc' }, { priority: 'desc' }, { position: 'asc' }],
    });

    // Group entries by doctor and calculate wait times (include all doctors with patients)
    const doctorQueues = doctors.map(doctor => {
      const doctorEntries = queueEntries.filter(e => e.doctorId === doctor.id);
      const consultationDuration = doctor.appointmentDurationMin || 15;
      const isCheckedIn = checkedInDoctorIds.has(doctor.id);

      // Find current patient with doctor
      const currentPatient = doctorEntries.find(e => e.status === 'WITH_DOCTOR');

      // Calculate wait times for each patient (only if doctor is checked in)
      const patients = doctorEntries.map((entry, index) => {
        let estimatedWaitMin: number | null = null;

        // Only calculate wait times if doctor is checked in
        if (isCheckedIn) {
          if (entry.status === 'WITH_DOCTOR') {
            estimatedWaitMin = 0; // Currently being seen
          } else {
            // Count patients ahead (with lower position in QUEUED/WAITING status)
            const ahead = doctorEntries.filter(
              e => e.position < entry.position && ['QUEUED', 'WAITING'].includes(e.status)
            ).length;

            if (currentPatient?.startedAt) {
              const elapsedMs = Date.now() - new Date(currentPatient.startedAt).getTime();
              const elapsedMin = Math.floor(elapsedMs / 60000);
              const remainingForCurrent = Math.max(0, consultationDuration - elapsedMin);
              estimatedWaitMin = remainingForCurrent + (ahead * consultationDuration);
            } else {
              estimatedWaitMin = ahead * consultationDuration;
            }
          }
        }

        return {
          token: entry.position,
          patientName: entry.patient.fullName,
          status: entry.status,
          priority: entry.priority,
          estimatedWaitMin,
          checkedInAt: entry.checkedInAt,
        };
      });

      return {
        doctorId: doctor.id,
        doctorName: doctor.fullName,
        consultationDuration,
        isCheckedIn,
        currentPatient: currentPatient ? {
          token: currentPatient.position,
          patientName: currentPatient.patient.fullName,
          startedAt: currentPatient.startedAt,
        } : null,
        waitingCount: patients.filter(p => p.status === 'QUEUED' || p.status === 'WAITING').length,
        patients: patients,
      };
    });

    // Include doctors with patients (regardless of check-in status)
    const activeQueues = doctorQueues.filter(dq => dq.patients.length > 0);

    // Calculate total incomplete patients (not completed/cancelled)
    const totalInQueue = queueEntries.length;

    return {
      clinicName: clinic.name,
      timezone,
      generatedAt: new Date().toISOString(),
      doctors: activeQueues,
      totalWaiting: queueEntries.filter(e => e.status === 'QUEUED' || e.status === 'WAITING').length,
      totalWithDoctor: queueEntries.filter(e => e.status === 'WITH_DOCTOR').length,
      totalInQueue, // Total patients in queue (not completed)
    };
  }

  // Get doctor check-in status for today
  async getDoctorCheckInStatus(clinicId: string, doctorId: string) {
    const clinic = await this.prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { timezone: true },
    });
    const timezone = clinic?.timezone || 'UTC';

    // Get today's date in clinic timezone
    const now = new Date();
    const todayStr = now.toLocaleDateString('en-CA', { timeZone: timezone });
    const todayDate = new Date(todayStr + 'T00:00:00.000Z');

    const checkIn = await this.prisma.doctorDailyCheckIn.findUnique({
      where: {
        doctorId_checkInDate: {
          doctorId,
          checkInDate: todayDate,
        },
      },
    });

    if (!checkIn) {
      return {
        isCheckedIn: false,
        checkInTime: null,
        checkOutTime: null,
      };
    }

    return {
      isCheckedIn: checkIn.checkOutTime === null,
      checkInTime: checkIn.checkInTime.toISOString(),
      checkOutTime: checkIn.checkOutTime?.toISOString() || null,
    };
  }

  // Check in doctor for today
  async doctorCheckIn(clinicId: string, doctorId: string) {
    // Verify doctor exists and belongs to clinic
    const doctor = await this.prisma.doctor.findFirst({
      where: { id: doctorId, clinicId, isActive: true },
    });

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    const clinic = await this.prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { timezone: true },
    });
    const timezone = clinic?.timezone || 'UTC';

    // Get today's date in clinic timezone
    const now = new Date();
    const todayStr = now.toLocaleDateString('en-CA', { timeZone: timezone });
    const todayDate = new Date(todayStr + 'T00:00:00.000Z');

    // Check if already checked in today
    const existing = await this.prisma.doctorDailyCheckIn.findUnique({
      where: {
        doctorId_checkInDate: {
          doctorId,
          checkInDate: todayDate,
        },
      },
    });

    if (existing && existing.checkOutTime === null) {
      throw new BadRequestException('Doctor is already checked in');
    }

    // Create or update check-in record
    const checkIn = await this.prisma.doctorDailyCheckIn.upsert({
      where: {
        doctorId_checkInDate: {
          doctorId,
          checkInDate: todayDate,
        },
      },
      create: {
        clinicId,
        doctorId,
        checkInDate: todayDate,
        checkInTime: now,
      },
      update: {
        checkInTime: now,
        checkOutTime: null,
      },
    });

    return {
      isCheckedIn: true,
      checkInTime: checkIn.checkInTime.toISOString(),
      checkOutTime: null,
    };
  }

  // Check out doctor for today
  async doctorCheckOut(clinicId: string, doctorId: string) {
    // Verify doctor exists and belongs to clinic
    const doctor = await this.prisma.doctor.findFirst({
      where: { id: doctorId, clinicId, isActive: true },
    });

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    const clinic = await this.prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { timezone: true },
    });
    const timezone = clinic?.timezone || 'UTC';

    // Get today's date in clinic timezone
    const now = new Date();
    const todayStr = now.toLocaleDateString('en-CA', { timeZone: timezone });
    const todayDate = new Date(todayStr + 'T00:00:00.000Z');

    // Check if checked in today
    const existing = await this.prisma.doctorDailyCheckIn.findUnique({
      where: {
        doctorId_checkInDate: {
          doctorId,
          checkInDate: todayDate,
        },
      },
    });

    if (!existing) {
      throw new BadRequestException('Doctor is not checked in today');
    }

    if (existing.checkOutTime !== null) {
      throw new BadRequestException('Doctor is already checked out');
    }

    // Check if doctor has any patients with status WITH_DOCTOR
    const activePatient = await this.prisma.queueEntry.findFirst({
      where: {
        clinicId,
        doctorId,
        queueDate: todayDate,
        status: 'WITH_DOCTOR',
      },
    });

    if (activePatient) {
      throw new BadRequestException('Cannot check out while a patient is being consulted');
    }

    // Update check-out time
    const checkIn = await this.prisma.doctorDailyCheckIn.update({
      where: {
        doctorId_checkInDate: {
          doctorId,
          checkInDate: todayDate,
        },
      },
      data: {
        checkOutTime: now,
      },
    });

    return {
      isCheckedIn: false,
      checkInTime: checkIn.checkInTime.toISOString(),
      checkOutTime: checkIn.checkOutTime?.toISOString() || null,
    };
  }
}
