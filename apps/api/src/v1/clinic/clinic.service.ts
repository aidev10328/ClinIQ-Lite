import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class ClinicService {
  constructor(private prisma: PrismaService) {}

  // Get current date/time in clinic timezone
  async getClinicTime(clinicId: string) {
    const clinic = await this.prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { timezone: true },
    });

    if (!clinic) {
      throw new NotFoundException('Clinic not found');
    }

    const timezone = clinic.timezone || 'UTC';
    const now = new Date();

    // Get current date in clinic timezone (YYYY-MM-DD format)
    const currentDate = now.toLocaleDateString('en-CA', { timeZone: timezone });

    // Get current time in clinic timezone
    const currentTime = now.toLocaleTimeString('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    // Get full datetime string
    const currentDateTime = now.toLocaleString('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    return {
      timezone,
      currentDate,        // '2026-02-11' format
      currentTime,        // '14:30' format
      currentDateTime,    // Full localized datetime
      serverTime: now.toISOString(),  // Server time for reference
    };
  }

  // Get clinic by ID
  async getClinic(clinicId: string) {
    const clinic = await this.prisma.clinic.findUnique({
      where: { id: clinicId },
      select: {
        id: true,
        name: true,
        logoUrl: true,
        phone: true,
        countryCode: true,
        street: true,
        city: true,
        state: true,
        postalCode: true,
        country: true,
        timezone: true,
        authMode: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!clinic) {
      throw new NotFoundException('Clinic not found');
    }

    return clinic;
  }

  // Update clinic profile (manager only)
  async updateClinic(
    clinicId: string,
    data: {
      name?: string;
      logoUrl?: string;
      phone?: string;
      street?: string;
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
      timezone?: string;
    },
  ) {
    return this.prisma.clinic.update({
      where: { id: clinicId },
      data,
      select: {
        id: true,
        name: true,
        logoUrl: true,
        phone: true,
        countryCode: true,
        street: true,
        city: true,
        state: true,
        postalCode: true,
        country: true,
        timezone: true,
        authMode: true,
        isActive: true,
        updatedAt: true,
      },
    });
  }

  // Platform: Create clinic (ADMIN only)
  async createClinic(data: {
    name: string;
    phone?: string;
    countryCode?: string;
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    timezone?: string;
  }) {
    return this.prisma.clinic.create({
      data: {
        name: data.name,
        phone: data.phone,
        countryCode: data.countryCode || 'US',
        street: data.street,
        city: data.city,
        state: data.state,
        postalCode: data.postalCode,
        country: data.country,
        timezone: data.timezone || 'America/Chicago',
      },
    });
  }

  // Platform: Update clinic (ADMIN only)
  async platformUpdateClinic(
    clinicId: string,
    data: {
      name?: string;
      phone?: string;
      countryCode?: string;
      street?: string;
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
      timezone?: string;
      isActive?: boolean;
    },
  ) {
    const clinic = await this.prisma.clinic.findUnique({ where: { id: clinicId } });
    if (!clinic) {
      throw new NotFoundException('Clinic not found');
    }

    return this.prisma.clinic.update({
      where: { id: clinicId },
      data,
    });
  }

  // Platform: List all clinics (ADMIN only)
  async listClinics() {
    return this.prisma.clinic.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        phone: true,
        countryCode: true,
        city: true,
        country: true,
        timezone: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: {
            clinicUsers: true,
            doctors: true,
            patients: true,
          },
        },
      },
    });
  }
}
