import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PlatformService } from './platform.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../../common/guards/platform-admin.guard';

@Controller('v1/platform/selectables')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class PlatformSelectablesController {
  constructor(private platformService: PlatformService) {}

  // GET /v1/platform/selectables - List selectables
  @Get()
  async listSelectables(@Query('key') key?: string) {
    return this.platformService.listSelectables(key);
  }

  // POST /v1/platform/selectables - Create selectable
  @Post()
  async createSelectable(
    @Body()
    body: {
      key: string;
      value: string;
      sortOrder?: number;
      isActive?: boolean;
    },
  ) {
    return this.platformService.createSelectable(body);
  }

  // PATCH /v1/platform/selectables/:id - Update selectable
  @Patch(':id')
  async updateSelectable(
    @Param('id') id: string,
    @Body()
    body: {
      key?: string;
      value?: string;
      sortOrder?: number;
      isActive?: boolean;
    },
  ) {
    return this.platformService.updateSelectable(id, body);
  }

  // DELETE /v1/platform/selectables/:id - Delete selectable
  @Delete(':id')
  async deleteSelectable(@Param('id') id: string) {
    return this.platformService.deleteSelectable(id);
  }
}
