import { Controller, Post, Body, Get, UseGuards, Request, UnauthorizedException } from '@nestjs/common';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { LoginDto, RegisterDto } from './auth.dto';

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
  constructor(private authService: AuthService) {}

  // Strict rate limiting on login: 5 attempts per minute per IP
  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async login(@Body() body: LoginDto) {
    const user = await this.authService.validateUser(body.email, body.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
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
