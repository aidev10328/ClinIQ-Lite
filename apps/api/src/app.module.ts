import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
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
    // Rate limiting: 60 requests per minute per IP (general)
    // Auth endpoints have stricter limits via decorator
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,   // 1 second
        limit: 3,    // 3 requests per second
      },
      {
        name: 'medium',
        ttl: 10000,  // 10 seconds
        limit: 20,   // 20 requests per 10 seconds
      },
      {
        name: 'long',
        ttl: 60000,  // 1 minute
        limit: 100,  // 100 requests per minute
      },
    ]),
    CommonModule,
    AuthModule,
    V1Module,
    AdminModule,
    SchedulerModule,
  ],
  controllers: [HealthController],
  providers: [
    PrismaService,
    CacheService,
    CacheWarmingService,
    // Apply rate limiting globally
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
  exports: [PrismaService, CacheService],
})
export class AppModule {}
