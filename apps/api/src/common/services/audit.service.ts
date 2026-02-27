import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { AuditAction } from '@prisma/client';

export interface AuditContext {
  userId?: string;
  userEmail?: string;
  clinicId?: string;
  clinicUserId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditEntry {
  action: AuditAction;
  entityType?: string;
  entityId?: string;
  details?: Record<string, unknown>;
  success?: boolean;
  errorMessage?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Log an audit event
   */
  async log(context: AuditContext, entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: entry.action,
          userId: context.userId,
          userEmail: context.userEmail,
          clinicId: context.clinicId,
          clinicUserId: context.clinicUserId,
          entityType: entry.entityType,
          entityId: entry.entityId,
          // Convert to Prisma-compatible JSON type
          details: entry.details as object | undefined,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          success: entry.success ?? true,
          errorMessage: entry.errorMessage,
        },
      });
    } catch (error) {
      // Don't let audit logging failures affect the main operation
      // But log the error for monitoring
      this.logger.error('Failed to write audit log', {
        action: entry.action,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Convenience methods for common audit events
   */
  async logLogin(context: AuditContext, success: boolean, errorMessage?: string): Promise<void> {
    await this.log(context, {
      action: success ? AuditAction.LOGIN_SUCCESS : AuditAction.LOGIN_FAILURE,
      success,
      errorMessage,
    });
  }

  async logLogout(context: AuditContext): Promise<void> {
    await this.log(context, { action: AuditAction.LOGOUT });
  }

  async logPatientAccess(context: AuditContext, patientId: string, action: 'view' | 'create' | 'update' | 'history'): Promise<void> {
    const actionMap = {
      view: AuditAction.PATIENT_VIEW,
      create: AuditAction.PATIENT_CREATE,
      update: AuditAction.PATIENT_UPDATE,
      history: AuditAction.PATIENT_HISTORY_VIEW,
    };
    await this.log(context, {
      action: actionMap[action],
      entityType: 'Patient',
      entityId: patientId,
    });
  }

  async logAppointmentAction(
    context: AuditContext,
    appointmentId: string,
    action: 'create' | 'update' | 'cancel',
    details?: Record<string, unknown>
  ): Promise<void> {
    const actionMap = {
      create: AuditAction.APPOINTMENT_CREATE,
      update: AuditAction.APPOINTMENT_UPDATE,
      cancel: AuditAction.APPOINTMENT_CANCEL,
    };
    await this.log(context, {
      action: actionMap[action],
      entityType: 'Appointment',
      entityId: appointmentId,
      details,
    });
  }

  async logDoctorAction(
    context: AuditContext,
    doctorId: string,
    action: 'create' | 'update' | 'deactivate' | 'license_assign' | 'license_revoke',
    details?: Record<string, unknown>
  ): Promise<void> {
    const actionMap = {
      create: AuditAction.DOCTOR_CREATE,
      update: AuditAction.DOCTOR_UPDATE,
      deactivate: AuditAction.DOCTOR_DEACTIVATE,
      license_assign: AuditAction.LICENSE_ASSIGN,
      license_revoke: AuditAction.LICENSE_REVOKE,
    };
    await this.log(context, {
      action: actionMap[action],
      entityType: 'Doctor',
      entityId: doctorId,
      details,
    });
  }

  async logScheduleChange(
    context: AuditContext,
    doctorId: string,
    changeType: 'update' | 'timeoff_create' | 'timeoff_delete',
    details?: Record<string, unknown>
  ): Promise<void> {
    const actionMap = {
      update: AuditAction.SCHEDULE_UPDATE,
      timeoff_create: AuditAction.TIMEOFF_CREATE,
      timeoff_delete: AuditAction.TIMEOFF_DELETE,
    };
    await this.log(context, {
      action: actionMap[changeType],
      entityType: 'Doctor',
      entityId: doctorId,
      details,
    });
  }

  async logStaffAction(
    context: AuditContext,
    staffUserId: string,
    action: 'add' | 'remove' | 'assignment_update',
    details?: Record<string, unknown>
  ): Promise<void> {
    const actionMap = {
      add: AuditAction.STAFF_ADD,
      remove: AuditAction.STAFF_REMOVE,
      assignment_update: AuditAction.STAFF_ASSIGNMENT_UPDATE,
    };
    await this.log(context, {
      action: actionMap[action],
      entityType: 'ClinicUser',
      entityId: staffUserId,
      details,
    });
  }

  /**
   * Query audit logs (for admin review)
   */
  async getAuditLogs(params: {
    clinicId?: string;
    userId?: string;
    action?: AuditAction;
    entityType?: string;
    entityId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }) {
    const where: Record<string, unknown> = {};

    if (params.clinicId) where.clinicId = params.clinicId;
    if (params.userId) where.userId = params.userId;
    if (params.action) where.action = params.action;
    if (params.entityType) where.entityType = params.entityType;
    if (params.entityId) where.entityId = params.entityId;

    if (params.startDate || params.endDate) {
      where.createdAt = {};
      if (params.startDate) (where.createdAt as Record<string, Date>).gte = params.startDate;
      if (params.endDate) (where.createdAt as Record<string, Date>).lte = params.endDate;
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: params.limit || 50,
        skip: params.offset || 0,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { logs, total };
  }
}
