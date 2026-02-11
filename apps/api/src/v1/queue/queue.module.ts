import { Module } from '@nestjs/common';
import { QueueController, PublicQueueController } from './queue.controller';
import { QueueService } from './queue.service';
import { PatientsService } from '../patients/patients.service';
import { PrismaService } from '../../prisma.service';

@Module({
  controllers: [QueueController, PublicQueueController],
  providers: [QueueService, PatientsService, PrismaService],
  exports: [QueueService],
})
export class QueueModule {}
