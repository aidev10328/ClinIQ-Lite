import { Module } from '@nestjs/common';
import { PlatformSelectablesController } from './platform.controller';
import { PlatformService } from './platform.service';
import { PrismaService } from '../../prisma.service';

@Module({
  controllers: [PlatformSelectablesController],
  providers: [PlatformService, PrismaService],
  exports: [PlatformService],
})
export class PlatformModule {}
