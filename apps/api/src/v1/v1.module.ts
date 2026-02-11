import { Module } from '@nestjs/common';
import { ClinicModule } from './clinic/clinic.module';
import { DoctorsModule } from './doctors/doctors.module';
import { PatientsModule } from './patients/patients.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { QueueModule } from './queue/queue.module';
import { PlatformModule } from './platform/platform.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ReportsModule } from './reports/reports.module';
import { ManagerModule } from './manager/manager.module';
import { LookupsModule } from './lookups/lookups.module';

@Module({
  imports: [
    ClinicModule,
    DoctorsModule,
    PatientsModule,
    AppointmentsModule,
    QueueModule,
    PlatformModule,
    DashboardModule,
    ReportsModule,
    ManagerModule,
    LookupsModule,
  ],
})
export class V1Module {}
