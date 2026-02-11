import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { PrismaService } from '../../prisma.service';

describe('AppointmentsService', () => {
  let service: AppointmentsService;
  let prisma: PrismaService;

  const mockClinicId = 'clinic-123';
  const mockDoctorId = 'doctor-123';
  const mockPatientId = 'patient-123';
  const mockAppointmentId = 'appointment-123';

  const mockDoctor = {
    id: mockDoctorId,
    clinicId: mockClinicId,
    fullName: 'Dr. John Doe',
    specialization: 'Cardiology',
    appointmentDurationMin: 30,
    isActive: true,
  };

  const mockPatient = {
    id: mockPatientId,
    clinicId: mockClinicId,
    fullName: 'Jane Smith',
    phone: '+1234567890',
  };

  const mockAppointment = {
    id: mockAppointmentId,
    clinicId: mockClinicId,
    doctorId: mockDoctorId,
    patientId: mockPatientId,
    startsAt: new Date('2024-01-15T10:00:00Z'),
    endsAt: new Date('2024-01-15T10:30:00Z'),
    status: 'BOOKED',
    createdByUserId: 'user-123',
    createdAt: new Date(),
    updatedAt: new Date(),
    doctor: { id: mockDoctorId, fullName: 'Dr. John Doe', specialization: 'Cardiology' },
    patient: { id: mockPatientId, fullName: 'Jane Smith', phone: '+1234567890' },
  };

  const mockPrismaService = {
    appointment: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    doctor: {
      findFirst: jest.fn(),
    },
    patient: {
      findFirst: jest.fn(),
    },
    queueEntry: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    patientPublicToken: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<AppointmentsService>(AppointmentsService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('listAppointments', () => {
    it('should return appointments for a specific date', async () => {
      mockPrismaService.appointment.findMany.mockResolvedValue([mockAppointment]);

      const result = await service.listAppointments(mockClinicId, {
        date: '2024-01-15',
      });

      expect(result).toEqual([mockAppointment]);
      expect(mockPrismaService.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            clinicId: mockClinicId,
            startsAt: expect.any(Object),
          }),
        }),
      );
    });

    it('should filter by doctorId when provided', async () => {
      mockPrismaService.appointment.findMany.mockResolvedValue([mockAppointment]);

      await service.listAppointments(mockClinicId, {
        date: '2024-01-15',
        doctorId: mockDoctorId,
      });

      expect(mockPrismaService.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            doctorId: mockDoctorId,
          }),
        }),
      );
    });
  });

  describe('createAppointment', () => {
    it('should create an appointment successfully', async () => {
      mockPrismaService.doctor.findFirst.mockResolvedValue(mockDoctor);
      mockPrismaService.patient.findFirst.mockResolvedValue(mockPatient);
      mockPrismaService.appointment.findFirst.mockResolvedValue(null); // No overlap
      mockPrismaService.appointment.create.mockResolvedValue(mockAppointment);

      const result = await service.createAppointment(
        mockClinicId,
        {
          doctorId: mockDoctorId,
          patientId: mockPatientId,
          startsAt: '2024-01-15T10:00:00Z',
        },
        'user-123',
      );

      expect(result).toEqual(mockAppointment);
      expect(mockPrismaService.appointment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            clinicId: mockClinicId,
            doctorId: mockDoctorId,
            patientId: mockPatientId,
            status: 'BOOKED',
          }),
        }),
      );
    });

    it('should throw NotFoundException when doctor not found', async () => {
      mockPrismaService.doctor.findFirst.mockResolvedValue(null);

      await expect(
        service.createAppointment(mockClinicId, {
          doctorId: mockDoctorId,
          patientId: mockPatientId,
          startsAt: '2024-01-15T10:00:00Z',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when patient not found', async () => {
      mockPrismaService.doctor.findFirst.mockResolvedValue(mockDoctor);
      mockPrismaService.patient.findFirst.mockResolvedValue(null);

      await expect(
        service.createAppointment(mockClinicId, {
          doctorId: mockDoctorId,
          patientId: mockPatientId,
          startsAt: '2024-01-15T10:00:00Z',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when slot overlaps', async () => {
      mockPrismaService.doctor.findFirst.mockResolvedValue(mockDoctor);
      mockPrismaService.patient.findFirst.mockResolvedValue(mockPatient);
      mockPrismaService.appointment.findFirst.mockResolvedValue(mockAppointment); // Overlap exists

      await expect(
        service.createAppointment(mockClinicId, {
          doctorId: mockDoctorId,
          patientId: mockPatientId,
          startsAt: '2024-01-15T10:00:00Z',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('cancelAppointment', () => {
    it('should cancel a booked appointment', async () => {
      mockPrismaService.appointment.findFirst.mockResolvedValue(mockAppointment);
      mockPrismaService.appointment.update.mockResolvedValue({
        ...mockAppointment,
        status: 'CANCELLED',
      });

      const result = await service.cancelAppointment(mockClinicId, mockAppointmentId);

      expect(result.status).toBe('CANCELLED');
      expect(mockPrismaService.appointment.update).toHaveBeenCalledWith({
        where: { id: mockAppointmentId },
        data: { status: 'CANCELLED' },
      });
    });

    it('should throw NotFoundException when appointment not found', async () => {
      mockPrismaService.appointment.findFirst.mockResolvedValue(null);

      await expect(
        service.cancelAppointment(mockClinicId, mockAppointmentId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when appointment is not booked', async () => {
      mockPrismaService.appointment.findFirst.mockResolvedValue({
        ...mockAppointment,
        status: 'COMPLETED',
      });

      await expect(
        service.cancelAppointment(mockClinicId, mockAppointmentId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('markNoShow', () => {
    it('should mark a booked appointment as no-show', async () => {
      mockPrismaService.appointment.findFirst.mockResolvedValue(mockAppointment);
      mockPrismaService.appointment.update.mockResolvedValue({
        ...mockAppointment,
        status: 'NO_SHOW',
      });

      const result = await service.markNoShow(mockClinicId, mockAppointmentId);

      expect(result.status).toBe('NO_SHOW');
    });

    it('should throw BadRequestException when appointment is not booked', async () => {
      mockPrismaService.appointment.findFirst.mockResolvedValue({
        ...mockAppointment,
        status: 'CANCELLED',
      });

      await expect(
        service.markNoShow(mockClinicId, mockAppointmentId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getAppointment', () => {
    it('should return an appointment when found', async () => {
      mockPrismaService.appointment.findFirst.mockResolvedValue(mockAppointment);

      const result = await service.getAppointment(mockClinicId, mockAppointmentId);

      expect(result).toEqual(mockAppointment);
    });

    it('should throw NotFoundException when appointment not found', async () => {
      mockPrismaService.appointment.findFirst.mockResolvedValue(null);

      await expect(
        service.getAppointment(mockClinicId, mockAppointmentId),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
