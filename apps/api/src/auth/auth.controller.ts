import { Controller, Post, Body, Get, UseGuards, Request, UnauthorizedException, Req } from '@nestjs/common';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { Request as ExpressRequest } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { LoginDto, RegisterDto } from './auth.dto';
import { AuditService } from '../common/services/audit.service';

// User type for typed request
interface AuthenticatedUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
}

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private auditService: AuditService,
  ) {}

  // Strict rate limiting on login: 5 attempts per minute per IP
  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async login(@Body() body: LoginDto, @Req() req: ExpressRequest) {
    // Extract audit context from request
    const auditContext = {
      userEmail: body.email.toLowerCase().trim(),
      ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip,
      userAgent: req.headers['user-agent'],
    };

    const user = await this.authService.validateUser(body.email, body.password);

    if (!user) {
      // Log failed login attempt (don't await - fire and forget)
      this.auditService.logLogin(auditContext, false, 'Invalid credentials');
      throw new UnauthorizedException('Invalid credentials');
    }

    // Log successful login (don't await - fire and forget)
    this.auditService.logLogin({ ...auditContext, userId: user.id }, true);

    return this.authService.login(user);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @SkipThrottle() // Authenticated users don't need rate limiting here
  async me(@Request() req: { user: AuthenticatedUser }) {
    return req.user;
  }

  // Strict rate limiting on register: 3 attempts per minute per IP
  @Post('register')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  async register(@Body() body: RegisterDto) {
    return this.authService.register(body);
  }
}
