import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { PersistentSlotsService } from '../v1/doctors/persistent-slots.service';

export type DoctorSlotStatus = {
  doctorId: string;
  doctorName: string;
  specialization: string;
  hasLicense: boolean;
  isActive: boolean;
  scheduleConfiguredAt: Date | null;
  hasSchedule: boolean;
  slotsGeneratedFrom: string | null;  // YYYY-MM-DD or null
  slotsGeneratedTo: string | null;    // YYYY-MM-DD or null
  slotCount: number;          // Renamed for frontend compatibility
  availableSlots: number;
  bookedSlots: number;
  blockedSlots: number;
};

export type ClinicSlotStatus = {
  clinicId: string;
  clinicName: string;
  totalDoctors: number;
  configuredDoctors: number;
  licensedDoctors: number;
  totalSlots: number;
  doctors: DoctorSlotStatus[];
};

export type BulkGenerationResult = {
  clinicId: string;
  clinicName: string;
  processedDoctors: number;
  totalSlotsCreated: number;
  errors: Array<{
    doctorId: string;
    doctorName: string;
    error: string;
  }>;
  doctorResults: Array<{
    doctorId: string;
    doctorName: string;
    slotsCreated: number;
    startDate: string;
    endDate: string;
  }>;
};

@Injectable()
export class AdminSlotsService {
  constructor(
    private prisma: PrismaService,
    private persistentSlotsService: PersistentSlotsService,
  ) {}

  /**
   * Get slot status for all doctors in a clinic
   */
  async getClinicSlotStatus(clinicId: string): Promise<ClinicSlotStatus> {
    const clinic = await this.prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { id: true, name: true },
    });

    if (!clinic) {
      throw new NotFoundException('Clinic not found');
    }

    // Get all doctors for the clinic
    const doctors = await this.prisma.doctor.findMany({
      where: { clinicId },
      select: {
        id: true,
        fullName: true,
        specialization: true,
        hasLicense: true,
        isActive: true,
        scheduleConfiguredAt: true,
        slotsGeneratedFrom: true,
        slotsGeneratedTo: true,
        shiftTemplates: { select: { id: true } },
        weeklyShifts: { where: { isEnabled: true }, select: { id: true } },
      },
      orderBy: { fullName: 'asc' },
    });

    // Get slot counts for each doctor
    const doctorStatuses: DoctorSlotStatus[] = [];

    for (const doctor of doctors) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const endOfYear = new Date(today.getFullYear(), 11, 31);

      // Get slot counts
      const slotCounts = await this.prisma.slot.groupBy({
        by: ['status'],
        where: {
          doctorId: doctor.id,
          date: { gte: today, lte: endOfYear },
        },
        _count: { id: true },
      });

      const counts = {
        total: 0,
        available: 0,
        booked: 0,
      };

      for (const count of slotCounts) {
        counts.total += count._count.id;
        if (count.status === 'AVAILABLE') counts.available = count._count.id;
        if (count.status === 'BOOKED') counts.booked = count._count.id;
      }

      doctorStatuses.push({
        doctorId: doctor.id,
        doctorName: doctor.fullName,
        specialization: doctor.specialization,
        hasLicense: doctor.hasLicense,
        isActive: doctor.isActive,
        scheduleConfiguredAt: doctor.scheduleConfiguredAt,
        hasSchedule: doctor.shiftTemplates.length > 0 && doctor.weeklyShifts.length > 0,
        slotsGeneratedFrom: (doctor as any).slotsGeneratedFrom
          ? ((doctor as any).slotsGeneratedFrom as Date).toISOString().split('T')[0]
          : null,
        slotsGeneratedTo: (doctor as any).slotsGeneratedTo
          ? ((doctor as any).slotsGeneratedTo as Date).toISOString().split('T')[0]
          : null,
        slotCount: counts.total,
        availableSlots: counts.available,
        bookedSlots: counts.booked,
        blockedSlots: 0, // Not tracked in current count query
      });
    }

    return {
      clinicId: clinic.id,
      clinicName: clinic.name,
      totalDoctors: doctors.length,
      configuredDoctors: doctorStatuses.filter(d => d.scheduleConfiguredAt !== null).length,
      licensedDoctors: doctorStatuses.filter(d => d.hasLicense).length,
      totalSlots: doctorStatuses.reduce((sum, d) => sum + d.slotCount, 0),
      doctors: doctorStatuses,
    };
  }

  /**
   * Bulk generate slots for all configured doctors in a clinic
   * Generates from today to Dec 31st of the year
   */
  async bulkGenerateSlotsForClinic(
    clinicId: string,
    year?: number,
  ): Promise<BulkGenerationResult> {
    const clinic = await this.prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { id: true, name: true },
    });

    if (!clinic) {
      throw new NotFoundException('Clinic not found');
    }

    // Get all active doctors with license and configured schedule
    const doctors = await this.prisma.doctor.findMany({
      where: {
        clinicId,
        isActive: true,
        hasLicense: true,
      },
      include: {
        shiftTemplates: true,
        weeklyShifts: { where: { isEnabled: true } },
      },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetYear = year ?? today.getFullYear();

    // Start from today or Jan 1st of the target year (whichever is later)
    const startDate = new Date(Math.max(
      today.getTime(),
      new Date(targetYear, 0, 1).getTime()
    ));
    const endDate = new Date(targetYear, 11, 31);

    const result: BulkGenerationResult = {
      clinicId: clinic.id,
      clinicName: clinic.name,
      processedDoctors: 0,
      totalSlotsCreated: 0,
      errors: [],
      doctorResults: [],
    };

    for (const doctor of doctors) {
      // Check if doctor has schedule configured
      const hasSchedule = doctor.shiftTemplates.length > 0 && doctor.weeklyShifts.length > 0;

      if (!hasSchedule) {
        result.errors.push({
          doctorId: doctor.id,
          doctorName: doctor.fullName,
          error: 'Schedule not configured (no shift templates or weekly shifts)',
        });
        continue;
      }

      try {
        // Generate slots
        const genResult = await this.persistentSlotsService.generateAndPersistSlots(
          clinicId,
          doctor.id,
          startDate,
          endDate,
        );

        // Store the generation range and update scheduleConfiguredAt
        await this.prisma.doctor.update({
          where: { id: doctor.id },
          data: {
            scheduleConfiguredAt: doctor.scheduleConfiguredAt || new Date(),
            slotsGeneratedFrom: startDate,
            slotsGeneratedTo: endDate,
          },
        });

        result.processedDoctors++;
        result.totalSlotsCreated += genResult.created;
        result.doctorResults.push({
          doctorId: doctor.id,
          doctorName: doctor.fullName,
          slotsCreated: genResult.created,
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
        });
      } catch (error) {
        result.errors.push({
          doctorId: doctor.id,
          doctorName: doctor.fullName,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return result;
  }

  /**
   * Bulk generate slots for all clinics
   * Used by the scheduled job on Jan 1st
   */
  async bulkGenerateSlotsForAllClinics(year?: number): Promise<{
    processedClinics: number;
    totalSlotsCreated: number;
    results: BulkGenerationResult[];
  }> {
    // Get all active clinics
    const clinics = await this.prisma.clinic.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    const allResults: BulkGenerationResult[] = [];
    let totalSlotsCreated = 0;

    for (const clinic of clinics) {
      try {
        const result = await this.bulkGenerateSlotsForClinic(clinic.id, year);
        allResults.push(result);
        totalSlotsCreated += result.totalSlotsCreated;
      } catch (error) {
        // Log but continue with other clinics
        console.error(`Failed to generate slots for clinic ${clinic.id}:`, error);
      }
    }

    return {
      processedClinics: allResults.length,
      totalSlotsCreated,
      results: allResults,
    };
  }

  /**
   * Generate slots for a specific doctor with date range
   * This is the main admin-triggered slot generation method
   * Stores the generation range on the doctor for future schedule change regeneration
   */
  async generateSlotsForDoctor(
    clinicId: string,
    doctorId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<{
    doctorId: string;
    doctorName: string;
    slotsCreated: number;
    startDate: string;
    endDate: string;
  }> {
    const doctor = await this.prisma.doctor.findFirst({
      where: { id: doctorId, clinicId },
    });

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    // Get clinic timezone
    const clinic = await this.prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { timezone: true },
    });
    const timezone = clinic?.timezone || 'UTC';

    // Format today's date in clinic timezone
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const todayStr = formatter.format(now);
    const year = parseInt(todayStr.split('-')[0]);

    // Default: today to end of year
    const start = startDate || todayStr;
    const end = endDate || `${year}-12-31`;

    // Use the new method that stores the range on the doctor record
    const result = await this.persistentSlotsService.generateSlotsForRange(
      clinicId,
      doctorId,
      start,
      end,
    );

    return {
      doctorId: doctor.id,
      doctorName: doctor.fullName,
      slotsCreated: result.slotsCreated,
      startDate: result.startDate,
      endDate: result.endDate,
    };
  }

  /**
   * Delete all future available slots for a doctor
   * Useful for cleaning up before regenerating
   */
  async clearFutureSlots(
    clinicId: string,
    doctorId: string,
  ): Promise<{ deletedCount: number }> {
    const doctor = await this.prisma.doctor.findFirst({
      where: { id: doctorId, clinicId },
    });

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result = await this.prisma.slot.deleteMany({
      where: {
        clinicId,
        doctorId,
        date: { gte: today },
        status: 'AVAILABLE',
      },
    });

    return { deletedCount: result.count };
  }
}
