import { Global, Module } from '@nestjs/common';
import { TimezoneService } from './timezone.service';
import { AuditService } from './services/audit.service';
import { PrismaService } from '../prisma.service';

@Global()
@Module({
  providers: [TimezoneService, AuditService, PrismaService],
  exports: [TimezoneService, AuditService],
})
export class CommonModule {}
