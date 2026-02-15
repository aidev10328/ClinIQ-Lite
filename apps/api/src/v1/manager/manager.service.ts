import { Injectable, NotFoundException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { CacheService, CacheKeys, CacheTTL } from '../../cache.service';
import { CreateDoctorDto, UpdateDoctorDto, CreateStaffDto, UpdateStaffDto } from './manager.dto';
import { PersistentSlotsService } from '../doctors/persistent-slots.service';

// Helper to compute fullName from firstName + lastName
function computeFullName(firstName: string, lastName: string): string {
  return lastName ? `${firstName} ${lastName}`.trim() : firstName.trim();
}

@Injectable()
export class ManagerService {
  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
    private persistentSlotsService: PersistentSlotsService,
  ) {}

  // ============================================
  // Doctor Management (Manager Only)
  // ============================================

  // List all doctors in clinic (cached)
  async listDoctors(clinicId: string) {
    return this.cache.getOrSet(
      CacheKeys.doctors(clinicId),
      async () => {
        const doctors = await this.prisma.doctor.findMany({
          where: { clinicId },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            firstName: true,
            lastName: true,
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
            userId: true,
          },
        });

        // Get clinic user info for doctors with user accounts
        const doctorsWithUserIds = doctors.filter(d => d.userId);
        const clinicUsers = doctorsWithUserIds.length > 0
          ? await this.prisma.clinicUser.findMany({
              where: {
                clinicId,
                userId: { in: doctorsWithUserIds.map(d => d.userId!) },
              },
              select: { userId: true, role: true },
            })
          : [];

        const userRoleMap = new Map(clinicUsers.map(cu => [cu.userId, cu.role]));

        return doctors.map(doctor => ({
          ...doctor,
          hasUserAccount: !!doctor.userId,
          clinicRole: doctor.userId ? userRoleMap.get(doctor.userId) || null : null,
          userId: undefined, // Don't expose userId to frontend
        }));
      },
      CacheTTL.DOCTORS,
    );
  }

  // Get single doctor
  // NOTE: Removed _count for appointments/queueEntries as counting all
  // historical records is slow and not displayed in the UI
  async getDoctor(clinicId: string, doctorId: string) {
    const doctor = await this.prisma.doctor.findFirst({
      where: { id: doctorId, clinicId },
    });

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    return doctor;
  }

  // Create doctor (invalidates cache)
  // Optionally creates a user account and links it to the doctor
  async createDoctor(clinicId: string, dto: CreateDoctorDto) {
    const fullName = computeFullName(dto.firstName, dto.lastName);

    // If createUserAccount is true, email and password are required
    if (dto.createUserAccount) {
      if (!dto.email) {
        throw new BadRequestException('Email is required when creating a user account');
      }
      if (!dto.password) {
        throw new BadRequestException('Password is required when creating a user account');
      }

      // Check if user already exists with this email
      const existingUser = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });

      if (existingUser) {
        throw new ConflictException('A user with this email already exists');
      }

      // Create user, clinicUser, and doctor in a transaction
      const bcrypt = require('bcryptjs');
      const passwordHash = await bcrypt.hash(dto.password, 10);
      const email = dto.email!; // Already validated above

      const result = await this.prisma.$transaction(async (tx) => {
        // Create user
        const user = await tx.user.create({
          data: {
            email,
            passwordHash,
            firstName: dto.firstName.trim(),
            lastName: dto.lastName.trim(),
            role: 'USER',
            isActive: true,
          },
        });

        // Create clinicUser with appropriate role
        const clinicRole = dto.isManager ? 'CLINIC_MANAGER' : 'CLINIC_DOCTOR';
        await tx.clinicUser.create({
          data: {
            clinicId,
            userId: user.id,
            role: clinicRole,
            phone: dto.phone,
            isActive: true,
          },
        });

        // Create doctor linked to the user
        const doctor = await tx.doctor.create({
          data: {
            clinicId,
            userId: user.id,
            firstName: dto.firstName.trim(),
            lastName: dto.lastName.trim(),
            fullName,
            specialization: dto.specialization,
            phone: dto.phone,
            email: dto.email,
            photoUrl: dto.photoUrl,
            appointmentDurationMin: dto.appointmentDurationMin || 15,
            isActive: true,
            hasLicense: false,
          },
        });

        return doctor;
      });

      // Invalidate caches
      this.cache.invalidate(CacheKeys.doctors(clinicId));
      this.cache.invalidate(CacheKeys.staff(clinicId));
      this.cache.invalidate(CacheKeys.clinicStats(clinicId));
      return result;
    }

    // No user account creation - just create the doctor
    const doctor = await this.prisma.doctor.create({
      data: {
        clinicId,
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        fullName,
        specialization: dto.specialization,
        phone: dto.phone,
        email: dto.email,
        photoUrl: dto.photoUrl,
        appointmentDurationMin: dto.appointmentDurationMin || 15,
        isActive: true,
        hasLicense: false,
      },
    });
    // Invalidate doctors cache
    this.cache.invalidate(CacheKeys.doctors(clinicId));
    this.cache.invalidate(CacheKeys.clinicStats(clinicId));
    return doctor;
  }

  // Update doctor (invalidates cache)
  async updateDoctor(clinicId: string, doctorId: string, dto: UpdateDoctorDto) {
    const doctor = await this.prisma.doctor.findFirst({
      where: { id: doctorId, clinicId },
    });

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    // Build update data, recomputing fullName if firstName or lastName changes
    const updateData: any = {};

    const newFirstName = dto.firstName !== undefined ? dto.firstName.trim() : doctor.firstName;
    const newLastName = dto.lastName !== undefined ? dto.lastName.trim() : doctor.lastName;

    // If either name field changed, update both and recompute fullName
    if (dto.firstName !== undefined || dto.lastName !== undefined) {
      updateData.firstName = newFirstName;
      updateData.lastName = newLastName;
      updateData.fullName = computeFullName(newFirstName, newLastName);
    }

    if (dto.specialization !== undefined) updateData.specialization = dto.specialization;
    if (dto.phone !== undefined) updateData.phone = dto.phone;
    if (dto.email !== undefined) updateData.email = dto.email;
    if (dto.photoUrl !== undefined) updateData.photoUrl = dto.photoUrl;
    if (dto.appointmentDurationMin !== undefined) updateData.appointmentDurationMin = dto.appointmentDurationMin;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    // Handle user account creation for existing doctor
    if (dto.createUserAccount && !doctor.userId) {
      if (!dto.email && !doctor.email) {
        throw new BadRequestException('Email is required when creating a user account');
      }
      if (!dto.password) {
        throw new BadRequestException('Password is required when creating a user account');
      }

      const email = dto.email || doctor.email;

      // Check if user already exists with this email
      const existingUser = await this.prisma.user.findUnique({
        where: { email: email! },
      });

      if (existingUser) {
        throw new ConflictException('A user with this email already exists');
      }

      // Create user, clinicUser, and update doctor in a transaction
      const bcrypt = require('bcryptjs');
      const passwordHash = await bcrypt.hash(dto.password, 10);

      const result = await this.prisma.$transaction(async (tx) => {
        // Create user
        const user = await tx.user.create({
          data: {
            email: email!,
            passwordHash,
            firstName: newFirstName,
            lastName: newLastName,
            role: 'USER',
            isActive: true,
          },
        });

        // Create clinicUser with appropriate role
        const clinicRole = dto.isManager ? 'CLINIC_MANAGER' : 'CLINIC_DOCTOR';
        await tx.clinicUser.create({
          data: {
            clinicId,
            userId: user.id,
            role: clinicRole,
            phone: dto.phone || doctor.phone,
            isActive: true,
          },
        });

        // Update doctor with userId link
        const updatedDoctor = await tx.doctor.update({
          where: { id: doctorId },
          data: { ...updateData, userId: user.id, email: email },
        });

        return updatedDoctor;
      });

      // Invalidate caches
      this.cache.invalidate(CacheKeys.doctors(clinicId));
      this.cache.invalidate(CacheKeys.doctor(clinicId, doctorId));
      this.cache.invalidate(CacheKeys.staff(clinicId));
      return result;
    }

    // Handle role update for existing user account
    if (dto.isManager !== undefined && doctor.userId) {
      const clinicUser = await this.prisma.clinicUser.findUnique({
        where: { clinicId_userId: { clinicId, userId: doctor.userId } },
      });

      if (clinicUser) {
        const newRole = dto.isManager ? 'CLINIC_MANAGER' : 'CLINIC_DOCTOR';

        // Don't allow removing last manager
        if (!dto.isManager && clinicUser.role === 'CLINIC_MANAGER') {
          const managerCount = await this.prisma.clinicUser.count({
            where: { clinicId, role: 'CLINIC_MANAGER', isActive: true },
          });

          if (managerCount <= 1) {
            throw new BadRequestException('Cannot remove the last manager from the clinic');
          }
        }

        await this.prisma.clinicUser.update({
          where: { id: clinicUser.id },
          data: { role: newRole },
        });

        // Invalidate staff cache since roles changed
        this.cache.invalidate(CacheKeys.staff(clinicId));
      }
    }

    const updated = await this.prisma.doctor.update({
      where: { id: doctorId },
      data: updateData,
    });
    // Invalidate caches
    this.cache.invalidate(CacheKeys.doctors(clinicId));
    this.cache.invalidate(CacheKeys.doctor(clinicId, doctorId));
    return updated;
  }

  // Deactivate doctor (invalidates cache)
  async deactivateDoctor(clinicId: string, doctorId: string) {
    const doctor = await this.prisma.doctor.findFirst({
      where: { id: doctorId, clinicId },
    });

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    // If doctor has a license, revoke it first
    if (doctor.hasLicense) {
      await this.revokeLicense(clinicId, doctorId);
    }

    const updated = await this.prisma.doctor.update({
      where: { id: doctorId },
      data: { isActive: false },
    });
    // Invalidate caches
    this.cache.invalidate(CacheKeys.doctors(clinicId));
    this.cache.invalidate(CacheKeys.doctor(clinicId, doctorId));
    this.cache.invalidate(CacheKeys.clinicStats(clinicId));
    return updated;
  }

  // ============================================
  // License Management (Manager Only)
  // ============================================

  // Get clinic license info (cached)
  async getLicenseInfo(clinicId: string) {
    return this.cache.getOrSet(
      CacheKeys.licenses(clinicId),
      async () => {
        const clinic = await this.prisma.clinic.findUnique({
          where: { id: clinicId },
          select: {
            licensesTotal: true,
            licensesUsed: true,
          },
        });

        if (!clinic) {
          throw new NotFoundException('Clinic not found');
        }

        return {
          total: clinic.licensesTotal,
          used: clinic.licensesUsed,
          available: clinic.licensesTotal - clinic.licensesUsed,
        };
      },
      CacheTTL.LICENSES,
    );
  }

  // Assign license to doctor
  async assignLicense(clinicId: string, doctorId: string) {
    const clinic = await this.prisma.clinic.findUnique({ where: { id: clinicId } });
    if (!clinic) {
      throw new NotFoundException('Clinic not found');
    }

    const doctor = await this.prisma.doctor.findFirst({
      where: { id: doctorId, clinicId },
    });

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    if (doctor.hasLicense) {
      throw new ConflictException('Doctor already has a license assigned');
    }

    const availableLicenses = clinic.licensesTotal - clinic.licensesUsed;
    if (availableLicenses <= 0) {
      throw new BadRequestException('No available licenses. Contact admin to purchase more.');
    }

    // Assign license to doctor, update clinic, and add to all staff in a transaction
    const updatedDoctor = await this.prisma.$transaction(async (tx) => {
      const doc = await tx.doctor.update({
        where: { id: doctorId },
        data: {
          hasLicense: true,
          licenseAssignedAt: new Date(),
        },
      });

      await tx.clinic.update({
        where: { id: clinicId },
        data: {
          licensesUsed: { increment: 1 },
        },
      });

      // Auto-assign this doctor to all existing staff members
      const staffMembers = await tx.clinicUser.findMany({
        where: { clinicId, role: 'CLINIC_STAFF', isActive: true },
        select: { id: true },
      });

      if (staffMembers.length > 0) {
        await tx.staffDoctorAssignment.createMany({
          data: staffMembers.map((staff) => ({
            clinicId,
            clinicUserId: staff.id,
            doctorId,
          })),
          skipDuplicates: true,
        });
      }

      return doc;
    });

    // Invalidate caches
    this.cache.invalidate(CacheKeys.doctors(clinicId));
    this.cache.invalidate(CacheKeys.licenses(clinicId));
    this.cache.invalidate(CacheKeys.clinicStats(clinicId));
    this.cache.invalidate(CacheKeys.staff(clinicId));

    // Auto-generate slots for the newly licensed doctor (if schedule is configured)
    try {
      await this.persistentSlotsService.regenerateSlotsAfterScheduleChange(clinicId, doctorId);
    } catch (error) {
      // Log but don't fail - slots can be generated later
      console.warn(`Failed to auto-generate slots for doctor ${doctorId}:`, error);
    }

    return updatedDoctor;
  }

  // Revoke license from doctor
  async revokeLicense(clinicId: string, doctorId: string) {
    const doctor = await this.prisma.doctor.findFirst({
      where: { id: doctorId, clinicId },
    });

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    if (!doctor.hasLicense) {
      throw new ConflictException('Doctor does not have a license assigned');
    }

    // Revoke license from doctor and update clinic in a transaction
    const [updatedDoctor] = await this.prisma.$transaction([
      this.prisma.doctor.update({
        where: { id: doctorId },
        data: {
          hasLicense: false,
          licenseAssignedAt: null,
        },
      }),
      this.prisma.clinic.update({
        where: { id: clinicId },
        data: {
          licensesUsed: { decrement: 1 },
        },
      }),
    ]);

    // Delete all future available slots for this doctor
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const endOfYear = new Date(today.getFullYear(), 11, 31);
      await this.persistentSlotsService.deleteSlotsForDateRange(
        clinicId,
        doctorId,
        today,
        endOfYear,
      );
    } catch (error) {
      // Log but don't fail
      console.warn(`Failed to delete slots for doctor ${doctorId}:`, error);
    }

    // Invalidate caches
    this.cache.invalidate(CacheKeys.doctors(clinicId));
    this.cache.invalidate(CacheKeys.licenses(clinicId));
    this.cache.invalidate(CacheKeys.clinicStats(clinicId));
    return updatedDoctor;
  }

  // ============================================
  // Staff Management (Manager Only)
  // ============================================

  // List all staff in clinic (cached)
  async listStaff(clinicId: string) {
    return this.cache.getOrSet(
      CacheKeys.staff(clinicId),
      async () => {
        const clinicUsers = await this.prisma.clinicUser.findMany({
          where: { clinicId },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
            doctorAssignments: {
              include: {
                doctor: {
                  select: {
                    id: true,
                    fullName: true,
                    hasLicense: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        });

        return clinicUsers.map((cu) => ({
          id: cu.id,
          role: cu.role,
          phone: cu.phone,
          isActive: cu.isActive,
          createdAt: cu.createdAt,
          user: cu.user,
          assignedDoctors: cu.doctorAssignments.map((da) => da.doctor),
        }));
      },
      CacheTTL.STAFF,
    );
  }

  // Add staff member (creates user + links to clinic)
  // Auto-assigns all licensed doctors to new staff members
  async addStaff(clinicId: string, dto: CreateStaffDto) {
    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      // Check if already linked to this clinic
      const existingLink = await this.prisma.clinicUser.findUnique({
        where: { clinicId_userId: { clinicId, userId: existingUser.id } },
      });

      if (existingLink) {
        throw new ConflictException('User is already a member of this clinic');
      }

      // Link existing user to clinic and auto-assign all licensed doctors
      const clinicUser = await this.prisma.$transaction(async (tx) => {
        const cu = await tx.clinicUser.create({
          data: {
            clinicId,
            userId: existingUser.id,
            role: dto.role,
            phone: dto.phone,
            isActive: true,
          },
          include: {
            user: {
              select: { id: true, email: true, firstName: true, lastName: true },
            },
          },
        });

        // Auto-assign all licensed doctors to this staff member
        if (cu.role === 'CLINIC_STAFF') {
          await this.autoAssignLicensedDoctors(tx, clinicId, cu.id);
        }

        return cu;
      });

      // Invalidate cache
      this.cache.invalidate(CacheKeys.staff(clinicId));
      this.cache.invalidate(CacheKeys.clinicStats(clinicId));
      return clinicUser;
    }

    // Create new user and link to clinic
    const bcrypt = require('bcryptjs');
    const passwordHash = await bcrypt.hash(dto.password, 10);

    const clinicUser = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          role: 'USER',
          isActive: true,
        },
      });

      const cu = await tx.clinicUser.create({
        data: {
          clinicId,
          userId: user.id,
          role: dto.role,
          phone: dto.phone,
          isActive: true,
        },
        include: {
          user: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
      });

      // Auto-assign all licensed doctors to this staff member
      if (cu.role === 'CLINIC_STAFF') {
        await this.autoAssignLicensedDoctors(tx, clinicId, cu.id);
      }

      return cu;
    });

    // Invalidate cache
    this.cache.invalidate(CacheKeys.staff(clinicId));
    this.cache.invalidate(CacheKeys.clinicStats(clinicId));
    return clinicUser;
  }

  // Helper to auto-assign all licensed doctors to a staff member
  private async autoAssignLicensedDoctors(tx: any, clinicId: string, clinicUserId: string) {
    // Get all licensed doctors in the clinic
    const licensedDoctors = await tx.doctor.findMany({
      where: { clinicId, hasLicense: true, isActive: true },
      select: { id: true },
    });

    // Create assignments for each licensed doctor
    if (licensedDoctors.length > 0) {
      await tx.staffDoctorAssignment.createMany({
        data: licensedDoctors.map((doc: { id: string }) => ({
          clinicId,
          clinicUserId,
          doctorId: doc.id,
        })),
        skipDuplicates: true,
      });
    }
  }

  // Update staff member (invalidates cache)
  async updateStaff(clinicId: string, clinicUserId: string, data: UpdateStaffDto) {
    const clinicUser = await this.prisma.clinicUser.findFirst({
      where: { id: clinicUserId, clinicId },
    });

    if (!clinicUser) {
      throw new NotFoundException('Staff member not found');
    }

    const updated = await this.prisma.clinicUser.update({
      where: { id: clinicUserId },
      data: {
        ...(data.role && { role: data.role as any }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });
    // Invalidate cache
    this.cache.invalidate(CacheKeys.staff(clinicId));
    return updated;
  }

  // Remove staff member (invalidates cache)
  async removeStaff(clinicId: string, clinicUserId: string) {
    const clinicUser = await this.prisma.clinicUser.findFirst({
      where: { id: clinicUserId, clinicId },
    });

    if (!clinicUser) {
      throw new NotFoundException('Staff member not found');
    }

    // Check if this is the last manager
    if (clinicUser.role === 'CLINIC_MANAGER') {
      const managerCount = await this.prisma.clinicUser.count({
        where: { clinicId, role: 'CLINIC_MANAGER', isActive: true },
      });

      if (managerCount <= 1) {
        throw new BadRequestException('Cannot remove the last manager from the clinic');
      }
    }

    const updated = await this.prisma.clinicUser.update({
      where: { id: clinicUserId },
      data: { isActive: false },
    });
    // Invalidate cache
    this.cache.invalidate(CacheKeys.staff(clinicId));
    this.cache.invalidate(CacheKeys.clinicStats(clinicId));
    return updated;
  }

  // ============================================
  // Staff Doctor Assignments (Manager Only)
  // ============================================

  // Get staff member's assigned doctors
  async getStaffDoctorAssignments(clinicId: string, clinicUserId: string) {
    const clinicUser = await this.prisma.clinicUser.findFirst({
      where: { id: clinicUserId, clinicId },
    });

    if (!clinicUser) {
      throw new NotFoundException('Staff member not found');
    }

    const assignments = await this.prisma.staffDoctorAssignment.findMany({
      where: { clinicId, clinicUserId },
      include: {
        doctor: {
          select: {
            id: true,
            fullName: true,
            specialization: true,
            hasLicense: true,
            isActive: true,
          },
        },
      },
    });

    return assignments.map((a) => a.doctor);
  }

  // Update staff member's doctor assignments (replace all)
  async updateStaffDoctorAssignments(
    clinicId: string,
    clinicUserId: string,
    doctorIds: string[],
  ) {
    const clinicUser = await this.prisma.clinicUser.findFirst({
      where: { id: clinicUserId, clinicId },
    });

    if (!clinicUser) {
      throw new NotFoundException('Staff member not found');
    }

    // Verify all doctors exist and are licensed
    if (doctorIds.length > 0) {
      const doctors = await this.prisma.doctor.findMany({
        where: { id: { in: doctorIds }, clinicId, hasLicense: true },
      });

      if (doctors.length !== doctorIds.length) {
        throw new BadRequestException('Some doctors are not found or not licensed');
      }
    }

    // Replace all assignments in a transaction
    await this.prisma.$transaction(async (tx) => {
      // Delete existing assignments
      await tx.staffDoctorAssignment.deleteMany({
        where: { clinicId, clinicUserId },
      });

      // Create new assignments
      if (doctorIds.length > 0) {
        await tx.staffDoctorAssignment.createMany({
          data: doctorIds.map((doctorId) => ({
            clinicId,
            clinicUserId,
            doctorId,
          })),
        });
      }
    });

    // Invalidate cache
    this.cache.invalidate(CacheKeys.staff(clinicId));

    return this.getStaffDoctorAssignments(clinicId, clinicUserId);
  }

  // Get all licensed doctors for assignment selection
  async getLicensedDoctorsForAssignment(clinicId: string) {
    return this.prisma.doctor.findMany({
      where: { clinicId, hasLicense: true, isActive: true },
      select: {
        id: true,
        fullName: true,
        specialization: true,
      },
      orderBy: { fullName: 'asc' },
    });
  }

  // ============================================
  // Clinic Stats (Manager Only)
  // ============================================

  // Get clinic stats (cached)
  async getClinicStats(clinicId: string) {
    return this.cache.getOrSet(
      CacheKeys.clinicStats(clinicId),
      async () => {
        // Run all queries in parallel for better performance
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
          this.prisma.doctor.count({
            where: { clinicId, hasLicense: true },
          }),
          this.prisma.doctor.count({
            where: { clinicId, isActive: true },
          }),
        ]);

        if (!clinic) {
          throw new NotFoundException('Clinic not found');
        }

        return {
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
      },
      CacheTTL.CLINIC,
    );
  }
}
