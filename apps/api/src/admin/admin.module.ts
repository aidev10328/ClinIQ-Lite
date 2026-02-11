import { Module } from '@nestjs/common';
import { AdminClinicsController } from './admin-clinics.controller';
import { AdminClinicsService } from './admin-clinics.service';
import { AdminSlotsService } from './admin-slots.service';
import { PrismaService } from '../prisma.service';
import { DoctorsModule } from '../v1/doctors/doctors.module';

@Module({
  imports: [DoctorsModule],
  controllers: [AdminClinicsController],
  providers: [AdminClinicsService, AdminSlotsService, PrismaService],
  exports: [AdminSlotsService],
})
export class AdminModule {}
