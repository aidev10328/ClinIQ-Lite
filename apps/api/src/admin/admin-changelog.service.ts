import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ChangeType } from '@prisma/client';

export interface CreateChangeLogDto {
  type: ChangeType;
  title: string;
  description: string;
  rootCause?: string;
  resolution: string;
  changedFiles: string[];
  impact?: string;
  version?: string;
  reportedBy?: string;
  resolvedBy?: string;
  resolvedAt?: Date;
}

export interface UpdateChangeLogDto {
  type?: ChangeType;
  title?: string;
  description?: string;
  rootCause?: string;
  resolution?: string;
  changedFiles?: string[];
  impact?: string;
  version?: string;
  reportedBy?: string;
  resolvedBy?: string;
  resolvedAt?: Date;
}

export interface ChangeLogFilters {
  type?: ChangeType;
  search?: string;
  from?: string;
  to?: string;
}

@Injectable()
export class AdminChangelogService {
  constructor(private prisma: PrismaService) {}

  // List all change logs with optional filters
  async listChangeLogs(filters: ChangeLogFilters = {}) {
    const where: any = {};

    if (filters.type) {
      where.type = filters.type;
    }

    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
        { resolution: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters.from || filters.to) {
      where.resolvedAt = {};
      if (filters.from) {
        where.resolvedAt.gte = new Date(filters.from);
      }
      if (filters.to) {
        const toDate = new Date(filters.to);
        toDate.setHours(23, 59, 59, 999);
        where.resolvedAt.lte = toDate;
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.changeLog.findMany({
        where,
        orderBy: { number: 'desc' },
      }),
      this.prisma.changeLog.count({ where }),
    ]);

    return { items, total };
  }

  // Get a single change log by ID
  async getChangeLog(id: string) {
    const changeLog = await this.prisma.changeLog.findUnique({
      where: { id },
    });

    if (!changeLog) {
      throw new NotFoundException('Change log not found');
    }

    return changeLog;
  }

  // Get a change log by number
  async getChangeLogByNumber(number: number) {
    const changeLog = await this.prisma.changeLog.findUnique({
      where: { number },
    });

    if (!changeLog) {
      throw new NotFoundException('Change log not found');
    }

    return changeLog;
  }

  // Create a new change log entry
  async createChangeLog(data: CreateChangeLogDto) {
    return this.prisma.changeLog.create({
      data: {
        type: data.type,
        title: data.title,
        description: data.description,
        rootCause: data.rootCause,
        resolution: data.resolution,
        changedFiles: data.changedFiles,
        impact: data.impact,
        version: data.version,
        reportedBy: data.reportedBy,
        resolvedBy: data.resolvedBy,
        resolvedAt: data.resolvedAt || new Date(),
      },
    });
  }

  // Update an existing change log
  async updateChangeLog(id: string, data: UpdateChangeLogDto) {
    const existing = await this.prisma.changeLog.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Change log not found');
    }

    return this.prisma.changeLog.update({
      where: { id },
      data,
    });
  }

  // Delete a change log
  async deleteChangeLog(id: string) {
    const existing = await this.prisma.changeLog.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Change log not found');
    }

    return this.prisma.changeLog.delete({
      where: { id },
    });
  }

  // Get statistics
  async getStats() {
    const [total, byType] = await Promise.all([
      this.prisma.changeLog.count(),
      this.prisma.changeLog.groupBy({
        by: ['type'],
        _count: true,
      }),
    ]);

    const typeStats = byType.reduce(
      (acc, item) => {
        acc[item.type] = item._count;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      total,
      byType: typeStats,
    };
  }
}
