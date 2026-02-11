import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class PlatformService {
  constructor(private prisma: PrismaService) {}

  // List selectables by key
  async listSelectables(key?: string) {
    const where: any = {};
    if (key) {
      where.key = key;
    }

    return this.prisma.platformSelectable.findMany({
      where,
      orderBy: [{ key: 'asc' }, { sortOrder: 'asc' }],
    });
  }

  // Create selectable
  async createSelectable(data: {
    key: string;
    value: string;
    sortOrder?: number;
    isActive?: boolean;
  }) {
    return this.prisma.platformSelectable.create({
      data: {
        key: data.key,
        value: data.value,
        sortOrder: data.sortOrder || 0,
        isActive: data.isActive ?? true,
      },
    });
  }

  // Update selectable
  async updateSelectable(
    id: string,
    data: {
      key?: string;
      value?: string;
      sortOrder?: number;
      isActive?: boolean;
    },
  ) {
    const selectable = await this.prisma.platformSelectable.findUnique({
      where: { id },
    });

    if (!selectable) {
      throw new NotFoundException('Selectable not found');
    }

    return this.prisma.platformSelectable.update({
      where: { id },
      data,
    });
  }

  // Delete selectable
  async deleteSelectable(id: string) {
    const selectable = await this.prisma.platformSelectable.findUnique({
      where: { id },
    });

    if (!selectable) {
      throw new NotFoundException('Selectable not found');
    }

    return this.prisma.platformSelectable.delete({
      where: { id },
    });
  }
}
