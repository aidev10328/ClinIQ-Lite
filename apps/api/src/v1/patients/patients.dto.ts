import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  Min,
  Max,
  MaxLength,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SearchPatientsQueryDto {
  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9]*$/, { message: 'Phone must contain only digits' })
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Search query must be at most 100 characters' })
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Limit must be an integer' })
  @Min(1, { message: 'Limit must be at least 1' })
  @Max(100, { message: 'Limit must be at most 100' })
  limit?: number;
}

export class CreatePatientDto {
  @IsString()
  @IsNotEmpty({ message: 'Full name is required' })
  @MaxLength(200, { message: 'Full name must be at most 200 characters' })
  fullName: string;

  @IsString()
  @IsNotEmpty({ message: 'Phone is required' })
  @Matches(/^\+?[0-9]{10,15}$/, { message: 'Phone must be a valid phone number (10-15 digits)' })
  phone: string;
}

export class UpdatePatientDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Full name cannot be empty' })
  @MaxLength(200, { message: 'Full name must be at most 200 characters' })
  fullName?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9]{10,15}$/, { message: 'Phone must be a valid phone number (10-15 digits)' })
  phone?: string;
}
