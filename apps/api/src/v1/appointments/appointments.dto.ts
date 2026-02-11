import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  IsUUID,
} from 'class-validator';

export class ListAppointmentsQueryDto {
  @IsOptional()
  @IsDateString({}, { message: 'Date must be a valid ISO date string (YYYY-MM-DD)' })
  date?: string;

  @IsOptional()
  @IsUUID('4', { message: 'Doctor ID must be a valid UUID' })
  doctorId?: string;
}

export class CreateAppointmentDto {
  @IsUUID('4', { message: 'Doctor ID must be a valid UUID' })
  @IsNotEmpty({ message: 'Doctor ID is required' })
  doctorId: string;

  @IsUUID('4', { message: 'Patient ID must be a valid UUID' })
  @IsNotEmpty({ message: 'Patient ID is required' })
  patientId: string;

  @IsOptional()
  @IsUUID('4', { message: 'Slot ID must be a valid UUID' })
  slotId?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Start time must be a valid ISO date string' })
  startsAt?: string;

  @IsOptional()
  @IsString({ message: 'Reason must be a string' })
  reason?: string;
}
