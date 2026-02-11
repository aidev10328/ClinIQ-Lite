import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { HealthController } from './health/health.controller';
import { PrismaService } from './prisma.service';
import { CacheService } from './cache.service';
import { CacheWarmingService } from './cache-warming.service';
import { V1Module } from './v1/v1.module';
import { AdminModule } from './admin/admin.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { CommonModule } from './common/common.module';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CommonModule,
    AuthModule,
    V1Module,
    AdminModule,
    SchedulerModule,
  ],
  controllers: [HealthController],
  providers: [PrismaService, CacheService, CacheWarmingService],
  exports: [PrismaService, CacheService],
})
export class AppModule {}
