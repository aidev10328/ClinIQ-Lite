import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { TimezoneService } from '../../common/timezone.service';
import { PersistentSlotsService } from '../doctors/persistent-slots.service';
import { randomBytes } from 'crypto';

@Injectable()
export class AppointmentsService {
  constructor(
    private prisma: PrismaService,
    private timezoneService: TimezoneService,
    private persistentSlotsService: PersistentSlotsService,
  ) {}

  /**
   * Get clinic timezone
   */
  private async getClinicTimezone(clinicId: string): Promise<string> {
    const clinic = await this.prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { timezone: true },
    });
    return clinic?.timezone || 'UTC';
  }

  // List appointments for a date/doctor
  // Date filtering uses clinic timezone
  async listAppointments(
    clinicId: string,
    filters: { date?: string; doctorId?: string },
  ) {
    const where: any = { clinicId };

    if (filters.date) {
      const timezone = await this.getClinicTimezone(clinicId);

      // Parse date as clinic local date and get start/end of day
      const startOfDay = this.timezoneService.createDateInTimezone(filters.date, '00:00', timezone);
      const endOfDay = this.timezoneService.createDateInTimezone(filters.date, '23:59', timezone);
      endOfDay.setSeconds(59);
      endOfDay.setMilliseconds(999);

      where.startsAt = {
        gte: startOfDay,
        lte: endOfDay,
      };
    }

    if (filters.doctorId) {
      where.doctorId = filters.doctorId;
    }

    return this.prisma.appointment.findMany({
      where,
      orderBy: { startsAt: 'asc' },
      include: {
        doctor: { select: { id: true, fullName: true, specialization: true } },
        patient: { select: { id: true, fullName: true, phone: true } },
      },
    });
  }

  // Get single appointment
  async getAppointment(clinicId: string, appointmentId: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, clinicId },
      include: {
        doctor: { select: { id: true, fullName: true, specialization: true } },
        patient: { select: { id: true, fullName: true, phone: true } },
      },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    return appointment;
  }

  // Create appointment using slotId (preferred) or startsAt (fallback)
  async createAppointment(
    clinicId: string,
    data: {
      doctorId: string;
      patientId: string;
      slotId?: string;      // Preferred: use persisted slot
      startsAt?: string;    // Fallback: for backwards compatibility
      reason?: string;      // Optional reason for visit
    },
    createdByUserId?: string,
  ) {
    // Get doctor to calculate end time
    const doctor = await this.prisma.doctor.findFirst({
      where: { id: data.doctorId, clinicId, isActive: true },
    });

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    // Verify patient belongs to clinic
    const patient = await this.prisma.patient.findFirst({
      where: { id: data.patientId, clinicId },
    });

    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    let startsAt: Date;
    let endsAt: Date;
    let slotId: string | undefined = data.slotId;

    // If slotId is provided, use the persisted slot
    if (data.slotId) {
      const slot = await this.prisma.slot.findUnique({
        where: { id: data.slotId },
      });

      if (!slot) {
        throw new NotFoundException('Slot not found');
      }

      if (slot.clinicId !== clinicId || slot.doctorId !== data.doctorId) {
        throw new BadRequestException('Slot does not belong to this doctor/clinic');
      }

      if (slot.status !== 'AVAILABLE') {
        throw new ConflictException('Slot is not available');
      }

      startsAt = slot.startsAt;
      endsAt = slot.endsAt;
    } else if (data.startsAt) {
      // Fallback to startsAt for backwards compatibility
      startsAt = new Date(data.startsAt);
      endsAt = new Date(startsAt.getTime() + doctor.appointmentDurationMin * 60 * 1000);

      // Try to find a matching persisted slot
      const matchingSlot = await this.persistentSlotsService.findSlotByTime(data.doctorId, startsAt);
      if (matchingSlot) {
        if (matchingSlot.status !== 'AVAILABLE') {
          throw new ConflictException('Time slot is not available');
        }
        slotId = matchingSlot.id;
      } else {
        // Check for overlapping appointments (only if no persisted slot exists)
        const overlap = await this.prisma.appointment.findFirst({
          where: {
            clinicId,
            doctorId: data.doctorId,
            status: { in: ['BOOKED'] },
            OR: [
              {
                startsAt: { lt: endsAt },
                endsAt: { gt: startsAt },
              },
            ],
          },
        });

        if (overlap) {
          throw new ConflictException('Time slot overlaps with existing appointment');
        }
      }
    } else {
      throw new BadRequestException('Either slotId or startsAt must be provided');
    }

    // Create appointment and book slot in transaction
    return this.prisma.$transaction(async (tx) => {
      // Create the appointment
      const appointment = await tx.appointment.create({
        data: {
          clinicId,
          doctorId: data.doctorId,
          patientId: data.patientId,
          startsAt,
          endsAt,
          reason: data.reason,
          status: 'BOOKED',
          createdByUserId,
        },
        include: {
          doctor: { select: { id: true, fullName: true } },
          patient: { select: { id: true, fullName: true, phone: true } },
        },
      });

      // Book the slot if we have one
      if (slotId) {
        await tx.slot.update({
          where: { id: slotId },
          data: {
            status: 'BOOKED',
            appointmentId: appointment.id,
          },
        });
      }

      return appointment;
    });
  }

  // Cancel appointment and release the slot
  async cancelAppointment(clinicId: string, appointmentId: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, clinicId },
      include: { slot: true },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    if (appointment.status !== 'BOOKED') {
      throw new BadRequestException('Only booked appointments can be cancelled');
    }

    // Cancel appointment and release slot in transaction
    return this.prisma.$transaction(async (tx) => {
      // Update appointment status
      const updatedAppointment = await tx.appointment.update({
        where: { id: appointmentId },
        data: { status: 'CANCELLED' },
      });

      // Release the slot if it exists
      if (appointment.slot) {
        await tx.slot.update({
          where: { id: appointment.slot.id },
          data: {
            status: 'AVAILABLE',
            appointmentId: null,
          },
        });
      }

      return updatedAppointment;
    });
  }

  // Reschedule appointment - marks as RESCHEDULED and releases the slot
  async rescheduleAppointment(clinicId: string, appointmentId: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, clinicId },
      include: {
        slot: true,
        patient: { select: { id: true, fullName: true, phone: true } },
        doctor: { select: { id: true, fullName: true } },
      },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    if (appointment.status !== 'BOOKED') {
      throw new BadRequestException('Only booked appointments can be rescheduled');
    }

    // Mark as rescheduled and release slot in transaction
    return this.prisma.$transaction(async (tx) => {
      // Update appointment status to RESCHEDULED
      const updatedAppointment = await tx.appointment.update({
        where: { id: appointmentId },
        data: { status: 'RESCHEDULED' },
        include: {
          patient: { select: { id: true, fullName: true, phone: true } },
          doctor: { select: { id: true, fullName: true } },
        },
      });

      // Release the slot if it exists
      if (appointment.slot) {
        await tx.slot.update({
          where: { id: appointment.slot.id },
          data: {
            status: 'AVAILABLE',
            appointmentId: null,
          },
        });
      }

      return updatedAppointment;
    });
  }

  // Mark appointment as no-show (creates completed queue entry with NO_SHOW outcome)
  async markNoShow(clinicId: string, appointmentId: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, clinicId },
      include: { patient: true, doctor: true },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    if (appointment.status !== 'BOOKED') {
      throw new BadRequestException('Only booked appointments can be marked as no-show');
    }

    // Get clinic timezone and today's date as UTC midnight
    // For @db.Date fields, we must use UTC midnight dates
    const timezone = await this.getClinicTimezone(clinicId);
    const now = new Date();
    const todayStr = now.toLocaleDateString('en-CA', { timeZone: timezone }); // YYYY-MM-DD format
    const today = new Date(todayStr + 'T00:00:00.000Z'); // UTC midnight

    // Get next position in queue for this doctor today
    const lastEntry = await this.prisma.queueEntry.findFirst({
      where: {
        clinicId,
        doctorId: appointment.doctorId,
        queueDate: today,
      },
      orderBy: { position: 'desc' },
    });

    const position = (lastEntry?.position || 0) + 1;

    // Create queue entry with COMPLETED status and NO_SHOW outcome in transaction
    return this.prisma.$transaction(async (tx) => {
      // Update appointment status
      await tx.appointment.update({
        where: { id: appointmentId },
        data: { status: 'NO_SHOW' },
      });

      // Create completed queue entry for no-show
      const queueEntry = await tx.queueEntry.create({
        data: {
          clinicId,
          doctorId: appointment.doctorId,
          patientId: appointment.patientId,
          queueDate: today,
          position,
          priority: 'NORMAL',
          status: 'COMPLETED',
          outcome: 'NO_SHOW',
          source: 'APPOINTMENT',
          reason: appointment.reason,
          checkedInAt: now,
          completedAt: now,
        },
        include: {
          patient: { select: { id: true, fullName: true, phone: true } },
          doctor: { select: { id: true, fullName: true } },
        },
      });

      return queueEntry;
    });
  }

  // Check-in appointment (creates queue entry)
  // Uses clinic timezone for queue date
  async checkinAppointment(clinicId: string, appointmentId: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, clinicId },
      include: { patient: true, doctor: true },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    if (appointment.status !== 'BOOKED') {
      throw new BadRequestException('Only booked appointments can be checked in');
    }

    // Get clinic timezone and today's date as UTC midnight
    // For @db.Date fields, we must use UTC midnight dates
    const timezone = await this.getClinicTimezone(clinicId);
    const now = new Date();
    const todayStr = now.toLocaleDateString('en-CA', { timeZone: timezone }); // YYYY-MM-DD format
    const today = new Date(todayStr + 'T00:00:00.000Z'); // UTC midnight

    // Get next position in queue for this doctor today
    const lastEntry = await this.prisma.queueEntry.findFirst({
      where: {
        clinicId,
        doctorId: appointment.doctorId,
        queueDate: today,
      },
      orderBy: { position: 'desc' },
    });

    const position = (lastEntry?.position || 0) + 1;

    // Create queue entry and generate token in transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Update appointment status to CHECKED_IN (will become COMPLETED or NO_SHOW when queue entry is completed)
      await tx.appointment.update({
        where: { id: appointmentId },
        data: { status: 'CHECKED_IN' },
      });

      // Create queue entry
      const queueEntry = await tx.queueEntry.create({
        data: {
          clinicId,
          doctorId: appointment.doctorId,
          patientId: appointment.patientId,
          queueDate: today,
          position,
          priority: 'NORMAL',
          status: 'QUEUED',
          source: 'APPOINTMENT',
        },
        include: {
          patient: { select: { id: true, fullName: true, phone: true } },
          doctor: { select: { id: true, fullName: true } },
        },
      });

      // Generate public token - expires end of day in clinic timezone
      const token = randomBytes(16).toString('hex');
      const expiresAt = this.timezoneService.getEndOfDayInTimezone(new Date(), timezone);

      const publicToken = await tx.patientPublicToken.create({
        data: {
          clinicId,
          token,
          queueEntryId: queueEntry.id,
          appointmentId,
          patientId: appointment.patientId,
          expiresAt,
        },
      });

      return { queueEntry, token: publicToken.token };
    });

    return {
      queueEntry: result.queueEntry,
      token: result.token,
      urlPath: `/p/${result.token}`,
    };
  }
}
