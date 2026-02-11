import { Module } from '@nestjs/common';
import { ClinicController, PlatformClinicController } from './clinic.controller';
import { ClinicService } from './clinic.service';
import { PrismaService } from '../../prisma.service';

@Module({
  controllers: [ClinicController, PlatformClinicController],
  providers: [ClinicService, PrismaService],
  exports: [ClinicService],
})
export class ClinicModule {}
