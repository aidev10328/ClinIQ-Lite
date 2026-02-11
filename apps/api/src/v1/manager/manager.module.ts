import { Module } from '@nestjs/common';
import { ManagerController } from './manager.controller';
import { ManagerService } from './manager.service';
import { PrismaService } from '../../prisma.service';
import { DoctorsModule } from '../doctors/doctors.module';

@Module({
  imports: [DoctorsModule],
  controllers: [ManagerController],
  providers: [ManagerService, PrismaService],
  exports: [ManagerService],
})
export class ManagerModule {}
