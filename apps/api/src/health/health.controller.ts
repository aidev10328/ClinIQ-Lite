import { Controller, Get, Res, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '../prisma.service';

@Controller()
export class HealthController {
  constructor(private prisma: PrismaService) {}

  /**
   * Liveness probe - always returns 200 if the process is running
   * Used by Kubernetes to know if container needs restart
   */
  @Get('health')
  async health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  /**
   * Readiness probe - returns 200 only if dependencies are ready
   * Used by Kubernetes to know if traffic should be routed to this instance
   * Returns 503 Service Unavailable if database is not connected
   */
  @Get('ready')
  async ready(@Res() res: Response) {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return res.status(HttpStatus.OK).json({
        status: 'ready',
        database: 'connected',
        timestamp: new Date().toISOString(),
      });
    } catch {
      return res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        status: 'not_ready',
        database: 'disconnected',
        timestamp: new Date().toISOString(),
      });
    }
  }
}
