import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { ManagerService } from './manager.service';
import { PrismaService } from '../../prisma.service';
import { CacheService } from '../../cache.service';

describe('ManagerService', () => {
  let service: ManagerService;
  let prisma: PrismaService;
  let cache: CacheService;

  const mockClinicId = 'clinic-123';
  const mockDoctorId = 'doctor-123';

  const mockDoctor = {
    id: mockDoctorId,
    clinicId: mockClinicId,
    firstName: 'John',
    lastName: 'Doe',
    fullName: 'John Doe',
    specialization: 'Cardiology',
    phone: '+1234567890',
    email: 'john@example.com',
    photoUrl: null,
    appointmentDurationMin: 15,
    hasLicense: false,
    licenseAssignedAt: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPrismaService = {
    doctor: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    clinic: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    clinicUser: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockCacheService = {
    getOrSet: jest.fn((key, fn) => fn()),
    invalidate: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ManagerService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: CacheService, useValue: mockCacheService },
      ],
    }).compile();

    service = module.get<ManagerService>(ManagerService);
    prisma = module.get<PrismaService>(PrismaService);
    cache = module.get<CacheService>(CacheService);

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe('createDoctor', () => {
    it('should create a doctor with firstName and lastName', async () => {
      const createDto = {
        firstName: 'John',
        lastName: 'Doe',
        specialization: 'Cardiology',
        phone: '+1234567890',
        email: 'john@example.com',
      };

      mockPrismaService.doctor.create.mockResolvedValue(mockDoctor);

      const result = await service.createDoctor(mockClinicId, createDto);

      expect(mockPrismaService.doctor.create).toHaveBeenCalledWith({
        data: {
          clinicId: mockClinicId,
          firstName: 'John',
          lastName: 'Doe',
          fullName: 'John Doe',
          specialization: 'Cardiology',
          phone: '+1234567890',
          email: 'john@example.com',
          photoUrl: undefined,
          appointmentDurationMin: 15,
          isActive: true,
          hasLicense: false,
        },
      });
      expect(result).toEqual(mockDoctor);
      expect(mockCacheService.invalidate).toHaveBeenCalled();
    });

    it('should compute fullName correctly with only firstName', async () => {
      const createDto = {
        firstName: 'John',
        lastName: '',
        specialization: 'Cardiology',
      };

      const doctorWithNoLastName = { ...mockDoctor, lastName: '', fullName: 'John' };
      mockPrismaService.doctor.create.mockResolvedValue(doctorWithNoLastName);

      await service.createDoctor(mockClinicId, createDto);

      expect(mockPrismaService.doctor.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            fullName: 'John',
          }),
        }),
      );
    });
  });

  describe('updateDoctor', () => {
    it('should update doctor and recompute fullName when firstName changes', async () => {
      mockPrismaService.doctor.findFirst.mockResolvedValue(mockDoctor);
      mockPrismaService.doctor.update.mockResolvedValue({
        ...mockDoctor,
        firstName: 'Jane',
        fullName: 'Jane Doe',
      });

      const result = await service.updateDoctor(mockClinicId, mockDoctorId, {
        firstName: 'Jane',
      });

      expect(mockPrismaService.doctor.update).toHaveBeenCalledWith({
        where: { id: mockDoctorId },
        data: expect.objectContaining({
          firstName: 'Jane',
          lastName: 'Doe',
          fullName: 'Jane Doe',
        }),
      });
      expect(mockCacheService.invalidate).toHaveBeenCalled();
    });

    it('should throw NotFoundException when doctor not found', async () => {
      mockPrismaService.doctor.findFirst.mockResolvedValue(null);

      await expect(
        service.updateDoctor(mockClinicId, mockDoctorId, { firstName: 'Jane' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getDoctor', () => {
    it('should return a doctor when found', async () => {
      mockPrismaService.doctor.findFirst.mockResolvedValue(mockDoctor);

      const result = await service.getDoctor(mockClinicId, mockDoctorId);

      expect(result).toEqual(mockDoctor);
      expect(mockPrismaService.doctor.findFirst).toHaveBeenCalledWith({
        where: { id: mockDoctorId, clinicId: mockClinicId },
      });
    });

    it('should throw NotFoundException when doctor not found', async () => {
      mockPrismaService.doctor.findFirst.mockResolvedValue(null);

      await expect(service.getDoctor(mockClinicId, mockDoctorId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('deactivateDoctor', () => {
    it('should deactivate a doctor', async () => {
      mockPrismaService.doctor.findFirst.mockResolvedValue(mockDoctor);
      mockPrismaService.doctor.update.mockResolvedValue({
        ...mockDoctor,
        isActive: false,
      });

      const result = await service.deactivateDoctor(mockClinicId, mockDoctorId);

      expect(result.isActive).toBe(false);
      expect(mockCacheService.invalidate).toHaveBeenCalled();
    });

    it('should revoke license before deactivating if doctor has one', async () => {
      const doctorWithLicense = { ...mockDoctor, hasLicense: true };
      mockPrismaService.doctor.findFirst
        .mockResolvedValueOnce(doctorWithLicense) // deactivateDoctor call
        .mockResolvedValueOnce(doctorWithLicense); // revokeLicense call

      mockPrismaService.$transaction.mockResolvedValue([
        { ...doctorWithLicense, hasLicense: false },
        {},
      ]);
      mockPrismaService.doctor.update.mockResolvedValue({
        ...doctorWithLicense,
        isActive: false,
        hasLicense: false,
      });

      await service.deactivateDoctor(mockClinicId, mockDoctorId);

      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });
  });

  describe('assignLicense', () => {
    it('should assign a license to a doctor', async () => {
      const clinic = { id: mockClinicId, licensesTotal: 5, licensesUsed: 2 };
      mockPrismaService.clinic.findUnique.mockResolvedValue(clinic);
      mockPrismaService.doctor.findFirst.mockResolvedValue(mockDoctor);
      mockPrismaService.$transaction.mockResolvedValue([
        { ...mockDoctor, hasLicense: true },
        clinic,
      ]);

      const result = await service.assignLicense(mockClinicId, mockDoctorId);

      expect(result.hasLicense).toBe(true);
      expect(mockCacheService.invalidate).toHaveBeenCalled();
    });

    it('should throw ConflictException if doctor already has a license', async () => {
      const clinic = { id: mockClinicId, licensesTotal: 5, licensesUsed: 2 };
      mockPrismaService.clinic.findUnique.mockResolvedValue(clinic);
      mockPrismaService.doctor.findFirst.mockResolvedValue({
        ...mockDoctor,
        hasLicense: true,
      });

      await expect(service.assignLicense(mockClinicId, mockDoctorId)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw BadRequestException if no licenses available', async () => {
      const clinic = { id: mockClinicId, licensesTotal: 2, licensesUsed: 2 };
      mockPrismaService.clinic.findUnique.mockResolvedValue(clinic);
      mockPrismaService.doctor.findFirst.mockResolvedValue(mockDoctor);

      await expect(service.assignLicense(mockClinicId, mockDoctorId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
