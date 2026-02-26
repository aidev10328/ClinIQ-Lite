import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  AdminChangelogService,
  CreateChangeLogDto,
  UpdateChangeLogDto,
  ChangeLogFilters,
} from './admin-changelog.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { ChangeType } from '@prisma/client';

@Controller('admin/changelog')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminChangelogController {
  constructor(private changelogService: AdminChangelogService) {}

  // GET /admin/changelog - List all change logs with optional filters
  @Get()
  async listChangeLogs(
    @Query('type') type?: ChangeType,
    @Query('search') search?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const filters: ChangeLogFilters = { type, search, from, to };
    return this.changelogService.listChangeLogs(filters);
  }

  // GET /admin/changelog/stats - Get changelog statistics
  @Get('stats')
  async getStats() {
    return this.changelogService.getStats();
  }

  // GET /admin/changelog/number/:number - Get changelog by number
  @Get('number/:number')
  async getChangeLogByNumber(@Param('number') number: string) {
    return this.changelogService.getChangeLogByNumber(parseInt(number, 10));
  }

  // GET /admin/changelog/:id - Get single changelog
  @Get(':id')
  async getChangeLog(@Param('id') id: string) {
    return this.changelogService.getChangeLog(id);
  }

  // POST /admin/changelog - Create changelog entry
  @Post()
  async createChangeLog(@Body() dto: CreateChangeLogDto) {
    return this.changelogService.createChangeLog(dto);
  }

  // PUT /admin/changelog/:id - Update changelog entry
  @Put(':id')
  async updateChangeLog(
    @Param('id') id: string,
    @Body() dto: UpdateChangeLogDto,
  ) {
    return this.changelogService.updateChangeLog(id, dto);
  }

  // DELETE /admin/changelog/:id - Delete changelog entry
  @Delete(':id')
  async deleteChangeLog(@Param('id') id: string) {
    return this.changelogService.deleteChangeLog(id);
  }
}
