import { Module } from '@nestjs/common';
import { DoctorsController } from './doctors.controller';
import { DoctorsService } from './doctors.service';
import { SlotsService } from './slots.service';
import { PersistentSlotsService } from './persistent-slots.service';
import { PrismaService } from '../../prisma.service';

@Module({
  controllers: [DoctorsController],
  providers: [DoctorsService, SlotsService, PersistentSlotsService, PrismaService],
  exports: [DoctorsService, SlotsService, PersistentSlotsService],
})
export class DoctorsModule {}
