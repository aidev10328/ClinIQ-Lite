import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SlotsSchedulerService } from './slots-scheduler.service';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    AdminModule,
  ],
  providers: [SlotsSchedulerService],
})
export class SchedulerModule {}
