import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

// Country code to phone prefix and timezone mapping
export const COUNTRY_CONFIG: Record<string, { phonePrefix: string; timezone: string; name: string }> = {
  US: { phonePrefix: '+1', timezone: 'America/Chicago', name: 'United States' },
  IN: { phonePrefix: '+91', timezone: 'Asia/Kolkata', name: 'India' },
  GB: { phonePrefix: '+44', timezone: 'Europe/London', name: 'United Kingdom' },
  CA: { phonePrefix: '+1', timezone: 'America/Toronto', name: 'Canada' },
  AU: { phonePrefix: '+61', timezone: 'Australia/Sydney', name: 'Australia' },
  DE: { phonePrefix: '+49', timezone: 'Europe/Berlin', name: 'Germany' },
  FR: { phonePrefix: '+33', timezone: 'Europe/Paris', name: 'France' },
  JP: { phonePrefix: '+81', timezone: 'Asia/Tokyo', name: 'Japan' },
  SG: { phonePrefix: '+65', timezone: 'Asia/Singapore', name: 'Singapore' },
  AE: { phonePrefix: '+971', timezone: 'Asia/Dubai', name: 'United Arab Emirates' },
};

export interface CreateClinicDto {
  name: string;
  phone?: string;
  countryCode?: string;
  timezone?: string;
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  logoUrl?: string;
  pictureUrl?: string;
  authMode?: 'PASSWORD' | 'PHONE_OTP';
}

export interface UpdateClinicDto {
  name?: string;
  phone?: string;
  countryCode?: string;
  timezone?: string;
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  logoUrl?: string;
  pictureUrl?: string;
  authMode?: 'PASSWORD' | 'PHONE_OTP';
  isActive?: boolean;
}

export interface CreateDoctorDto {
  fullName: string;
  specialization: string;
  phone?: string;
  email?: string;
  photoUrl?: string;
  appointmentDurationMin?: number;
}

export interface UpdateDoctorDto {
  fullName?: string;
  specialization?: string;
  phone?: string;
  email?: string;
  photoUrl?: string;
  appointmentDurationMin?: number;
  isActive?: boolean;
}

export interface PurchaseLicensesDto {
  quantity: number;
  pricePerLicense: number;
  currency?: string;
  paymentRef?: string;
  paymentMethod?: string;
  notes?: string;
}

export interface CreateManagerDto {
  email: string;
  firstName: string;
  lastName?: string;
  password: string;
  phone?: string;
}

export interface UpdateStaffDto {
  role?: 'CLINIC_MANAGER' | 'CLINIC_DOCTOR' | 'CLINIC_STAFF';
  isActive?: boolean;
}

@Injectable()
export class AdminClinicsService {
  constructor(private prisma: PrismaService) {}

  // Get country config
  getCountryConfig() {
    return COUNTRY_CONFIG;
  }

  // List all clinics with stats
  async findAll() {
    const clinics = await this.prisma.clinic.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            doctors: true,
            patients: true,
            clinicUsers: true,
          },
        },
      },
    });

    return clinics.map((clinic) => ({
      id: clinic.id,
      name: clinic.name,
      logoUrl: clinic.logoUrl,
      pictureUrl: clinic.pictureUrl,
      phone: clinic.phone,
      countryCode: clinic.countryCode,
      timezone: clinic.timezone,
      street: clinic.street,
      city: clinic.city,
      state: clinic.state,
      postalCode: clinic.postalCode,
      country: clinic.country,
      licensesTotal: clinic.licensesTotal,
      licensesUsed: clinic.licensesUsed,
      licensesAvailable: clinic.licensesTotal - clinic.licensesUsed,
      authMode: clinic.authMode,
      isActive: clinic.isActive,
      createdAt: clinic.createdAt,
      updatedAt: clinic.updatedAt,
      phonePrefix: COUNTRY_CONFIG[clinic.countryCode]?.phonePrefix || '+1',
      stats: {
        doctors: clinic._count.doctors,
        patients: clinic._count.patients,
        staff: clinic._count.clinicUsers,
      },
    }));
  }

  // Get single clinic with details
  async findOne(id: string) {
    const clinic = await this.prisma.clinic.findUnique({
      where: { id },
      include: {
        doctors: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            fullName: true,
            specialization: true,
            phone: true,
            email: true,
            photoUrl: true,
            hasLicense: true,
            licenseAssignedAt: true,
            isActive: true,
            createdAt: true,
          },
        },
        clinicUsers: {
          select: {
            id: true,
            role: true,
            isActive: true,
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        licensePurchases: {
          orderBy: { purchasedAt: 'desc' },
          take: 10,
          select: {
            id: true,
            quantity: true,
            pricePerLicense: true,
            totalAmount: true,
            currency: true,
            paymentRef: true,
            paymentMethod: true,
            notes: true,
            purchasedAt: true,
          },
        },
        _count: {
          select: {
            patients: true,
            appointments: true,
            queueEntries: true,
          },
        },
      },
    });

    if (!clinic) {
      throw new NotFoundException('Clinic not found');
    }

    return {
      id: clinic.id,
      name: clinic.name,
      logoUrl: clinic.logoUrl,
      pictureUrl: clinic.pictureUrl,
      phone: clinic.phone,
      countryCode: clinic.countryCode,
      timezone: clinic.timezone,
      street: clinic.street,
      city: clinic.city,
      state: clinic.state,
      postalCode: clinic.postalCode,
      country: clinic.country,
      licensesTotal: clinic.licensesTotal,
      licensesUsed: clinic.licensesUsed,
      licensesAvailable: clinic.licensesTotal - clinic.licensesUsed,
      authMode: clinic.authMode,
      isActive: clinic.isActive,
      createdAt: clinic.createdAt,
      updatedAt: clinic.updatedAt,
      phonePrefix: COUNTRY_CONFIG[clinic.countryCode]?.phonePrefix || '+1',
      doctors: clinic.doctors,
      clinicUsers: clinic.clinicUsers,
      licensePurchases: clinic.licensePurchases.map(lp => ({
        ...lp,
        pricePerLicense: Number(lp.pricePerLicense),
        totalAmount: Number(lp.totalAmount),
      })),
      stats: {
        patients: clinic._count.patients,
        appointments: clinic._count.appointments,
        queueEntries: clinic._count.queueEntries,
      },
    };
  }

  // Create new clinic
  async create(dto: CreateClinicDto) {
    const countryCode = dto.countryCode || 'US';
    const countryConfig = COUNTRY_CONFIG[countryCode] || COUNTRY_CONFIG.US;

    return this.prisma.clinic.create({
      data: {
        name: dto.name,
        phone: dto.phone,
        countryCode,
        timezone: dto.timezone || countryConfig.timezone,
        street: dto.street,
        city: dto.city,
        state: dto.state,
        postalCode: dto.postalCode,
        country: dto.country || countryConfig.name,
        logoUrl: dto.logoUrl,
        pictureUrl: dto.pictureUrl,
        authMode: dto.authMode || 'PASSWORD',
        isActive: true,
      },
    });
  }

  // Update clinic
  async update(id: string, dto: UpdateClinicDto) {
    const clinic = await this.prisma.clinic.findUnique({ where: { id } });
    if (!clinic) {
      throw new NotFoundException('Clinic not found');
    }

    // If country code changes, update timezone to match unless explicitly provided
    let timezone = dto.timezone;
    if (dto.countryCode && !dto.timezone) {
      const countryConfig = COUNTRY_CONFIG[dto.countryCode];
      if (countryConfig) {
        timezone = countryConfig.timezone;
      }
    }

    return this.prisma.clinic.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.countryCode && { countryCode: dto.countryCode }),
        ...(timezone && { timezone }),
        ...(dto.street !== undefined && { street: dto.street }),
        ...(dto.city !== undefined && { city: dto.city }),
        ...(dto.state !== undefined && { state: dto.state }),
        ...(dto.postalCode !== undefined && { postalCode: dto.postalCode }),
        ...(dto.country !== undefined && { country: dto.country }),
        ...(dto.logoUrl !== undefined && { logoUrl: dto.logoUrl }),
        ...(dto.pictureUrl !== undefined && { pictureUrl: dto.pictureUrl }),
        ...(dto.authMode && { authMode: dto.authMode }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  // Delete clinic (soft delete by setting isActive = false)
  async remove(id: string) {
    const clinic = await this.prisma.clinic.findUnique({ where: { id } });
    if (!clinic) {
      throw new NotFoundException('Clinic not found');
    }

    // Check if clinic has active data
    const activeDoctors = await this.prisma.doctor.count({
      where: { clinicId: id, isActive: true },
    });

    if (activeDoctors > 0) {
      throw new ConflictException(
        `Cannot delete clinic with ${activeDoctors} active doctors. Deactivate doctors first.`,
      );
    }

    return this.prisma.clinic.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // ============================================
  // Staff Management
  // ============================================

  // Add user to clinic as staff
  async addStaff(clinicId: string, userId: string, role: 'CLINIC_MANAGER' | 'CLINIC_DOCTOR' | 'CLINIC_STAFF') {
    const clinic = await this.prisma.clinic.findUnique({ where: { id: clinicId } });
    if (!clinic) {
      throw new NotFoundException('Clinic not found');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if already exists
    const existing = await this.prisma.clinicUser.findUnique({
      where: { clinicId_userId: { clinicId, userId } },
    });

    if (existing) {
      throw new ConflictException('User is already a member of this clinic');
    }

    return this.prisma.clinicUser.create({
      data: {
        clinicId,
        userId,
        role,
        isActive: true,
      },
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });
  }

  // Remove user from clinic
  async removeStaff(clinicId: string, userId: string) {
    const clinicUser = await this.prisma.clinicUser.findUnique({
      where: { clinicId_userId: { clinicId, userId } },
    });

    if (!clinicUser) {
      throw new NotFoundException('User is not a member of this clinic');
    }

    return this.prisma.clinicUser.delete({
      where: { clinicId_userId: { clinicId, userId } },
    });
  }

  // Update staff member
  async updateStaff(clinicId: string, clinicUserId: string, dto: UpdateStaffDto) {
    const clinicUser = await this.prisma.clinicUser.findFirst({
      where: { id: clinicUserId, clinicId },
    });

    if (!clinicUser) {
      throw new NotFoundException('Staff member not found in this clinic');
    }

    return this.prisma.clinicUser.update({
      where: { id: clinicUserId },
      data: {
        ...(dto.role && { role: dto.role }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });
  }

  // Create a manager for a clinic (creates user if needed)
  async createManager(clinicId: string, dto: CreateManagerDto) {
    const clinic = await this.prisma.clinic.findUnique({ where: { id: clinicId } });
    if (!clinic) {
      throw new NotFoundException('Clinic not found');
    }

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      // Check if already a manager for this clinic
      const existingLink = await this.prisma.clinicUser.findUnique({
        where: { clinicId_userId: { clinicId, userId: existingUser.id } },
      });

      if (existingLink) {
        throw new ConflictException('User is already a member of this clinic');
      }

      // Link existing user as manager
      return this.prisma.clinicUser.create({
        data: {
          clinicId,
          userId: existingUser.id,
          role: 'CLINIC_MANAGER',
          phone: dto.phone,
          isActive: true,
        },
        include: {
          user: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
      });
    }

    // Create new user and link as manager
    const bcrypt = require('bcryptjs');
    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: 'USER',
        isActive: true,
      },
    });

    return this.prisma.clinicUser.create({
      data: {
        clinicId,
        userId: user.id,
        role: 'CLINIC_MANAGER',
        phone: dto.phone,
        isActive: true,
      },
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });
  }

  // ============================================
  // Doctor Management
  // ============================================

  // Create doctor for clinic
  async createDoctor(clinicId: string, dto: CreateDoctorDto) {
    const clinic = await this.prisma.clinic.findUnique({ where: { id: clinicId } });
    if (!clinic) {
      throw new NotFoundException('Clinic not found');
    }

    return this.prisma.doctor.create({
      data: {
        clinicId,
        fullName: dto.fullName,
        specialization: dto.specialization,
        phone: dto.phone,
        email: dto.email,
        photoUrl: dto.photoUrl,
        appointmentDurationMin: dto.appointmentDurationMin || 15,
        isActive: true,
        hasLicense: false,
      },
    });
  }

  // Update doctor
  async updateDoctor(clinicId: string, doctorId: string, dto: UpdateDoctorDto) {
    const doctor = await this.prisma.doctor.findFirst({
      where: { id: doctorId, clinicId },
    });

    if (!doctor) {
      throw new NotFoundException('Doctor not found in this clinic');
    }

    return this.prisma.doctor.update({
      where: { id: doctorId },
      data: {
        ...(dto.fullName && { fullName: dto.fullName }),
        ...(dto.specialization && { specialization: dto.specialization }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.photoUrl !== undefined && { photoUrl: dto.photoUrl }),
        ...(dto.appointmentDurationMin && { appointmentDurationMin: dto.appointmentDurationMin }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  // Delete doctor (soft delete)
  async removeDoctor(clinicId: string, doctorId: string) {
    const doctor = await this.prisma.doctor.findFirst({
      where: { id: doctorId, clinicId },
    });

    if (!doctor) {
      throw new NotFoundException('Doctor not found in this clinic');
    }

    // If doctor had a license, revoke it first
    if (doctor.hasLicense) {
      await this.revokeLicense(clinicId, doctorId);
    }

    return this.prisma.doctor.update({
      where: { id: doctorId },
      data: { isActive: false },
    });
  }

  // ============================================
  // License Management
  // ============================================

  // Purchase licenses for clinic
  async purchaseLicenses(clinicId: string, dto: PurchaseLicensesDto) {
    const clinic = await this.prisma.clinic.findUnique({ where: { id: clinicId } });
    if (!clinic) {
      throw new NotFoundException('Clinic not found');
    }

    if (dto.quantity <= 0) {
      throw new BadRequestException('Quantity must be greater than 0');
    }

    if (dto.pricePerLicense < 0) {
      throw new BadRequestException('Price per license cannot be negative');
    }

    const totalAmount = dto.quantity * dto.pricePerLicense;

    // Create purchase record and update clinic licenses in a transaction
    const [purchase] = await this.prisma.$transaction([
      this.prisma.licensePurchase.create({
        data: {
          clinicId,
          quantity: dto.quantity,
          pricePerLicense: new Decimal(dto.pricePerLicense),
          totalAmount: new Decimal(totalAmount),
          currency: dto.currency || 'USD',
          paymentRef: dto.paymentRef,
          paymentMethod: dto.paymentMethod,
          notes: dto.notes,
        },
      }),
      this.prisma.clinic.update({
        where: { id: clinicId },
        data: {
          licensesTotal: { increment: dto.quantity },
        },
      }),
    ]);

    return {
      ...purchase,
      pricePerLicense: Number(purchase.pricePerLicense),
      totalAmount: Number(purchase.totalAmount),
    };
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
      throw new NotFoundException('Doctor not found in this clinic');
    }

    if (doctor.hasLicense) {
      throw new ConflictException('Doctor already has a license assigned');
    }

    const availableLicenses = clinic.licensesTotal - clinic.licensesUsed;
    if (availableLicenses <= 0) {
      throw new BadRequestException('No available licenses. Please purchase more licenses.');
    }

    // Assign license to doctor and update clinic in a transaction
    const [updatedDoctor] = await this.prisma.$transaction([
      this.prisma.doctor.update({
        where: { id: doctorId },
        data: {
          hasLicense: true,
          licenseAssignedAt: new Date(),
        },
      }),
      this.prisma.clinic.update({
        where: { id: clinicId },
        data: {
          licensesUsed: { increment: 1 },
        },
      }),
    ]);

    return updatedDoctor;
  }

  // Revoke license from doctor
  async revokeLicense(clinicId: string, doctorId: string) {
    const clinic = await this.prisma.clinic.findUnique({ where: { id: clinicId } });
    if (!clinic) {
      throw new NotFoundException('Clinic not found');
    }

    const doctor = await this.prisma.doctor.findFirst({
      where: { id: doctorId, clinicId },
    });

    if (!doctor) {
      throw new NotFoundException('Doctor not found in this clinic');
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

    return updatedDoctor;
  }

  // Get license purchase history
  async getLicensePurchases(clinicId: string) {
    const clinic = await this.prisma.clinic.findUnique({ where: { id: clinicId } });
    if (!clinic) {
      throw new NotFoundException('Clinic not found');
    }

    const purchases = await this.prisma.licensePurchase.findMany({
      where: { clinicId },
      orderBy: { purchasedAt: 'desc' },
    });

    return purchases.map(p => ({
      ...p,
      pricePerLicense: Number(p.pricePerLicense),
      totalAmount: Number(p.totalAmount),
    }));
  }
}
