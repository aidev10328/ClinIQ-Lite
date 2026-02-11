import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class PatientsService {
  constructor(private prisma: PrismaService) {}

  // Search patients by phone or name
  async searchPatients(
    clinicId: string,
    filters: { phone?: string; q?: string; limit?: number },
  ) {
    const where: any = { clinicId };

    if (filters.phone) {
      where.phone = { contains: filters.phone };
    }

    if (filters.q) {
      where.OR = [
        { fullName: { contains: filters.q, mode: 'insensitive' } },
        { phone: { contains: filters.q } },
      ];
    }

    return this.prisma.patient.findMany({
      where,
      take: filters.limit || 50,
      orderBy: { fullName: 'asc' },
      select: {
        id: true,
        fullName: true,
        phone: true,
        email: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  // Get single patient
  async getPatient(clinicId: string, patientId: string) {
    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, clinicId },
      select: {
        id: true,
        fullName: true,
        phone: true,
        email: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    return patient;
  }

  // Get patient visit history (appointments + queue entries)
  async getPatientHistory(clinicId: string, patientId: string) {
    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, clinicId },
      select: { id: true, fullName: true },
    });

    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    // Get all appointments
    const appointments = await this.prisma.appointment.findMany({
      where: { patientId, clinicId },
      orderBy: { startsAt: 'desc' },
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        status: true,
        reason: true,
        doctor: { select: { fullName: true } },
      },
    });

    // Get all queue entries (walk-ins)
    const queueEntries = await this.prisma.queueEntry.findMany({
      where: { patientId, clinicId },
      orderBy: { queueDate: 'desc' },
      select: {
        id: true,
        queueDate: true,
        checkedInAt: true,
        startedAt: true,
        completedAt: true,
        status: true,
        source: true,
        reason: true,
        outcome: true,
        doctor: { select: { fullName: true } },
      },
    });

    return {
      patient,
      appointments,
      queueEntries,
    };
  }

  // Validate phone number format (10 digits)
  private validatePhone(phone: string): string {
    // Extract digits only
    const digits = phone.replace(/\D/g, '');

    // For numbers with country code prefix, extract last 10 digits
    // e.g., +919876543210 -> 9876543210
    const normalized = digits.length > 10 ? digits.slice(-10) : digits;

    if (normalized.length !== 10) {
      throw new BadRequestException('Phone number must be 10 digits');
    }

    // Return the full phone with prefix for storage
    return phone;
  }

  // Create or update patient by phone (upsert)
  async upsertPatient(
    clinicId: string,
    data: {
      fullName: string;
      phone: string;
    },
  ) {
    const validatedPhone = this.validatePhone(data.phone);

    // Check if phone exists globally
    const existing = await this.prisma.patient.findUnique({
      where: { phone: validatedPhone },
    });

    if (existing) {
      // If exists in same clinic, update it
      if (existing.clinicId === clinicId) {
        return this.prisma.patient.update({
          where: { id: existing.id },
          data: { fullName: data.fullName },
        });
      }
      // If exists in different clinic, reject
      throw new ConflictException('This phone number is already registered');
    }

    // Create new patient
    return this.prisma.patient.create({
      data: {
        clinicId,
        fullName: data.fullName,
        phone: validatedPhone,
      },
    });
  }

  // Update patient
  async updatePatient(
    clinicId: string,
    patientId: string,
    data: {
      fullName?: string;
      phone?: string;
    },
  ) {
    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, clinicId },
    });

    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    // If updating phone, validate and check uniqueness
    if (data.phone) {
      const validatedPhone = this.validatePhone(data.phone);

      // Check if new phone already exists (and isn't this patient's)
      const existing = await this.prisma.patient.findUnique({
        where: { phone: validatedPhone },
      });

      if (existing && existing.id !== patientId) {
        throw new ConflictException('This phone number is already registered');
      }

      data.phone = validatedPhone;
    }

    return this.prisma.patient.update({
      where: { id: patientId },
      data,
    });
  }

  // Find or create patient by phone
  async findOrCreatePatient(
    clinicId: string,
    data: { fullName: string; phone: string },
  ) {
    const validatedPhone = this.validatePhone(data.phone);

    // Check if phone exists globally
    let patient = await this.prisma.patient.findUnique({
      where: { phone: validatedPhone },
    });

    if (patient) {
      // If exists in same clinic, return it
      if (patient.clinicId === clinicId) {
        return patient;
      }
      // If exists in different clinic, reject
      throw new ConflictException('This phone number is already registered');
    }

    // Create new patient
    patient = await this.prisma.patient.create({
      data: {
        clinicId,
        fullName: data.fullName,
        phone: validatedPhone,
      },
    });

    return patient;
  }
}
