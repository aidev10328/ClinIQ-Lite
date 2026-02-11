import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { CacheService, CacheKeys, CacheTTL } from './cache.service';

/**
 * Warms the cache on application startup to eliminate cold-start latency.
 * Pre-fetches commonly accessed data for all active clinics.
 */
@Injectable()
export class CacheWarmingService implements OnApplicationBootstrap {
  private readonly logger = new Logger(CacheWarmingService.name);

  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
  ) {}

  async onApplicationBootstrap() {
    // Run cache warming in background - don't block server startup
    this.warmCache().catch((err) => {
      this.logger.error('Cache warming failed', err);
    });
  }

  private async warmCache() {
    const startTime = Date.now();
    this.logger.log('Starting cache warm-up...');

    try {
      // Get all active clinics
      const clinics = await this.prisma.clinic.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
      });

      this.logger.log(`Found ${clinics.length} active clinic(s) to warm`);

      // Warm cache for each clinic in parallel
      await Promise.all(clinics.map((clinic) => this.warmClinicCache(clinic.id)));

      const duration = Date.now() - startTime;
      this.logger.log(`Cache warm-up completed in ${duration}ms for ${clinics.length} clinic(s)`);
    } catch (error) {
      this.logger.error('Cache warming error:', error);
    }
  }

  private async warmClinicCache(clinicId: string) {
    try {
      // Warm all manager-related caches in parallel
      await Promise.all([
        this.warmDoctorsCache(clinicId),
        this.warmLicensesCache(clinicId),
        this.warmStaffCache(clinicId),
        this.warmClinicStatsCache(clinicId),
      ]);
    } catch (error) {
      this.logger.warn(`Failed to warm cache for clinic ${clinicId}:`, error);
    }
  }

  private async warmDoctorsCache(clinicId: string) {
    const doctors = await this.prisma.doctor.findMany({
      where: { clinicId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fullName: true,
        specialization: true,
        phone: true,
        email: true,
        photoUrl: true,
        appointmentDurationMin: true,
        hasLicense: true,
        licenseAssignedAt: true,
        isActive: true,
        createdAt: true,
      },
    });

    this.cache.set(CacheKeys.doctors(clinicId), doctors, CacheTTL.DOCTORS);
  }

  private async warmLicensesCache(clinicId: string) {
    const clinic = await this.prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { licensesTotal: true, licensesUsed: true },
    });

    if (clinic) {
      const licenseInfo = {
        total: clinic.licensesTotal,
        used: clinic.licensesUsed,
        available: clinic.licensesTotal - clinic.licensesUsed,
      };
      this.cache.set(CacheKeys.licenses(clinicId), licenseInfo, CacheTTL.LICENSES);
    }
  }

  private async warmStaffCache(clinicId: string) {
    const clinicUsers = await this.prisma.clinicUser.findMany({
      where: { clinicId },
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const staff = clinicUsers.map((cu) => ({
      id: cu.id,
      role: cu.role,
      phone: cu.phone,
      isActive: cu.isActive,
      createdAt: cu.createdAt,
      user: cu.user,
    }));

    this.cache.set(CacheKeys.staff(clinicId), staff, CacheTTL.STAFF);
  }

  private async warmClinicStatsCache(clinicId: string) {
    const [clinic, licensedDoctors, activeDoctors] = await Promise.all([
      this.prisma.clinic.findUnique({
        where: { id: clinicId },
        include: {
          _count: {
            select: {
              doctors: true,
              patients: true,
              clinicUsers: true,
              appointments: true,
              queueEntries: true,
            },
          },
        },
      }),
      this.prisma.doctor.count({ where: { clinicId, hasLicense: true } }),
      this.prisma.doctor.count({ where: { clinicId, isActive: true } }),
    ]);

    if (clinic) {
      const stats = {
        clinic: {
          id: clinic.id,
          name: clinic.name,
          licensesTotal: clinic.licensesTotal,
          licensesUsed: clinic.licensesUsed,
          licensesAvailable: clinic.licensesTotal - clinic.licensesUsed,
        },
        counts: {
          doctors: clinic._count.doctors,
          activeDoctors,
          licensedDoctors,
          patients: clinic._count.patients,
          staff: clinic._count.clinicUsers,
          appointments: clinic._count.appointments,
          queueEntries: clinic._count.queueEntries,
        },
      };
      this.cache.set(CacheKeys.clinicStats(clinicId), stats, CacheTTL.CLINIC);
    }
  }
}
