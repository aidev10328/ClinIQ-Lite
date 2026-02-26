import { Module } from '@nestjs/common';
import { AdminClinicsController } from './admin-clinics.controller';
import { AdminChangelogController } from './admin-changelog.controller';
import { AdminClinicsService } from './admin-clinics.service';
import { AdminSlotsService } from './admin-slots.service';
import { AdminChangelogService } from './admin-changelog.service';
import { PrismaService } from '../prisma.service';
import { DoctorsModule } from '../v1/doctors/doctors.module';

@Module({
  imports: [DoctorsModule],
  controllers: [AdminClinicsController, AdminChangelogController],
  providers: [AdminClinicsService, AdminSlotsService, AdminChangelogService, PrismaService],
  exports: [AdminSlotsService],
})
export class AdminModule {}
