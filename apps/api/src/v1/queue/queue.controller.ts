import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { QueueService } from './queue.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ClinicGuard } from '../../common/guards/clinic.guard';
import { ClinicId, ClinicRoles } from '../../common/decorators/clinic.decorator';

@Controller('v1/queue')
@UseGuards(JwtAuthGuard, ClinicGuard)
export class QueueController {
  constructor(private queueService: QueueService) {}

  // GET /v1/queue - List queue entries
  // All clinic roles can view queue
  @Get()
  @ClinicRoles('CLINIC_MANAGER', 'CLINIC_STAFF', 'CLINIC_DOCTOR')
  async listQueue(
    @ClinicId() clinicId: string,
    @Query('date') date?: string,
    @Query('doctorId') doctorId?: string,
  ) {
    return this.queueService.listQueue(clinicId, { date, doctorId });
  }

  // GET /v1/queue/:id - Get single queue entry
  @Get(':id')
  @ClinicRoles('CLINIC_MANAGER', 'CLINIC_STAFF', 'CLINIC_DOCTOR')
  async getQueueEntry(@ClinicId() clinicId: string, @Param('id') id: string) {
    return this.queueService.getQueueEntry(clinicId, id);
  }

  // POST /v1/queue/walkin - Create walk-in entry (Staff/Manager only)
  @Post('walkin')
  @ClinicRoles('CLINIC_MANAGER', 'CLINIC_STAFF')
  async createWalkin(
    @ClinicId() clinicId: string,
    @Body()
    body: {
      doctorId: string;
      patientName: string;
      patientPhone: string;
      priority?: 'NORMAL' | 'URGENT' | 'EMERGENCY';
      reason?: string;
    },
  ) {
    return this.queueService.createWalkin(clinicId, body);
  }

  // PATCH /v1/queue/:id/status - Update status
  // All roles can update status (doctor starts/completes, staff can also manage)
  @Patch(':id/status')
  @ClinicRoles('CLINIC_MANAGER', 'CLINIC_STAFF', 'CLINIC_DOCTOR')
  async updateStatus(
    @ClinicId() clinicId: string,
    @Param('id') id: string,
    @Body()
    body: {
      status: 'QUEUED' | 'WAITING' | 'WITH_DOCTOR' | 'COMPLETED' | 'CANCELLED';
      outcome?: 'DONE' | 'NO_SHOW';
    },
  ) {
    return this.queueService.updateStatus(clinicId, id, body);
  }

  // POST /v1/queue/:id/token - Issue public token (Staff/Manager only)
  @Post(':id/token')
  @ClinicRoles('CLINIC_MANAGER', 'CLINIC_STAFF')
  async issueToken(
    @ClinicId() clinicId: string,
    @Param('id') id: string,
    @Body() body: { ttlMinutes?: number },
  ) {
    return this.queueService.issueToken(clinicId, id, body.ttlMinutes);
  }
}

// Public endpoint for patients to check queue status
@Controller('p')
export class PublicQueueController {
  constructor(private queueService: QueueService) {}

  // GET /p/:token - Get queue status by token
  @Get(':token')
  async getQueueByToken(@Param('token') token: string) {
    return this.queueService.getQueueByToken(token);
  }
}
