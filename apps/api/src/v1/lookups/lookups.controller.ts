import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('v1/lookups')
@UseGuards(JwtAuthGuard)
export class LookupsController {
  constructor(private prisma: PrismaService) {}

  // GET /v1/lookups/specializations - Get active specializations
  @Get('specializations')
  async getSpecializations() {
    return this.prisma.platformSelectable.findMany({
      where: {
        key: 'SPECIALIZATION',
        isActive: true,
      },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        value: true,
        sortOrder: true,
      },
    });
  }

  // GET /v1/lookups/selectables - Get selectables by key
  @Get('selectables')
  async getSelectables(@Query('key') key: string) {
    if (!key) {
      return [];
    }

    return this.prisma.platformSelectable.findMany({
      where: {
        key,
        isActive: true,
      },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        value: true,
        sortOrder: true,
      },
    });
  }
}
