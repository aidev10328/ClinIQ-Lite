import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  IsInt,
  IsBoolean,
  IsIn,
  Min,
  Max,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';

// ============================================
// Doctor DTOs
// ============================================

export class CreateDoctorDto {
  @IsString()
  @IsNotEmpty({ message: 'First name is required' })
  @MaxLength(100, { message: 'First name must be at most 100 characters' })
  firstName: string;

  @IsString()
  @IsNotEmpty({ message: 'Last name is required' })
  @MaxLength(100, { message: 'Last name must be at most 100 characters' })
  lastName: string;

  @IsString()
  @IsNotEmpty({ message: 'Specialization is required' })
  @MaxLength(100, { message: 'Specialization must be at most 100 characters' })
  specialization: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9]{10,15}$/, { message: 'Phone must be a valid phone number (10-15 digits)' })
  phone?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Email must be a valid email address' })
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Photo URL must be at most 500 characters' })
  photoUrl?: string;

  @IsOptional()
  @IsInt({ message: 'Appointment duration must be an integer' })
  @Min(5, { message: 'Appointment duration must be at least 5 minutes' })
  @Max(120, { message: 'Appointment duration must be at most 120 minutes' })
  appointmentDurationMin?: number;

  // User account creation options
  @IsOptional()
  @IsBoolean({ message: 'createUserAccount must be a boolean' })
  createUserAccount?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  @MaxLength(100, { message: 'Password must be at most 100 characters' })
  password?: string;

  @IsOptional()
  @IsBoolean({ message: 'isManager must be a boolean' })
  isManager?: boolean;
}

export class UpdateDoctorDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'First name cannot be empty' })
  @MaxLength(100, { message: 'First name must be at most 100 characters' })
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Last name must be at most 100 characters' })
  lastName?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Specialization cannot be empty' })
  @MaxLength(100, { message: 'Specialization must be at most 100 characters' })
  specialization?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9]{10,15}$/, { message: 'Phone must be a valid phone number (10-15 digits)' })
  phone?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Email must be a valid email address' })
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Photo URL must be at most 500 characters' })
  photoUrl?: string;

  @IsOptional()
  @IsInt({ message: 'Appointment duration must be an integer' })
  @Min(5, { message: 'Appointment duration must be at least 5 minutes' })
  @Max(120, { message: 'Appointment duration must be at most 120 minutes' })
  appointmentDurationMin?: number;

  @IsOptional()
  @IsBoolean({ message: 'isActive must be a boolean' })
  isActive?: boolean;

  // User account management
  @IsOptional()
  @IsBoolean({ message: 'createUserAccount must be a boolean' })
  createUserAccount?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  @MaxLength(100, { message: 'Password must be at most 100 characters' })
  password?: string;

  @IsOptional()
  @IsBoolean({ message: 'isManager must be a boolean' })
  isManager?: boolean;
}

// ============================================
// Staff DTOs
// ============================================

export class CreateStaffDto {
  @IsEmail({}, { message: 'Email must be a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'First name is required' })
  @MaxLength(100, { message: 'First name must be at most 100 characters' })
  firstName: string;

  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Last name must be at most 100 characters' })
  lastName?: string;

  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  @MaxLength(100, { message: 'Password must be at most 100 characters' })
  password: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9]{10,15}$/, { message: 'Phone must be a valid phone number (10-15 digits)' })
  phone?: string;

  @IsIn(['CLINIC_STAFF', 'CLINIC_DOCTOR'], { message: 'Role must be CLINIC_STAFF or CLINIC_DOCTOR' })
  role: 'CLINIC_STAFF' | 'CLINIC_DOCTOR';
}

export class UpdateStaffDto {
  @IsOptional()
  @IsIn(['CLINIC_STAFF', 'CLINIC_DOCTOR', 'CLINIC_MANAGER'], {
    message: 'Role must be CLINIC_STAFF, CLINIC_DOCTOR, or CLINIC_MANAGER',
  })
  role?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9]{10,15}$/, { message: 'Phone must be a valid phone number (10-15 digits)' })
  phone?: string;

  @IsOptional()
  @IsBoolean({ message: 'isActive must be a boolean' })
  isActive?: boolean;
}
