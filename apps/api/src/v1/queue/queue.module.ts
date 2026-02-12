import { Module } from '@nestjs/common';
import { QueueController, PublicQueueController, TvDisplayController } from './queue.controller';
import { QueueService } from './queue.service';
import { PatientsService } from '../patients/patients.service';
import { PrismaService } from '../../prisma.service';
import { TimezoneService } from '../../common/timezone.service';

@Module({
  controllers: [QueueController, PublicQueueController, TvDisplayController],
  providers: [QueueService, PatientsService, PrismaService, TimezoneService],
  exports: [QueueService],
})
export class QueueModule {}
