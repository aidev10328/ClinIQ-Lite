import { Module } from '@nestjs/common';
import { LookupsController } from './lookups.controller';
import { PrismaService } from '../../prisma.service';

@Module({
  controllers: [LookupsController],
  providers: [PrismaService],
})
export class LookupsModule {}
