import { Injectable, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma.service';

// Bcrypt rounds - 12 provides good security vs performance balance
// Higher = more secure but slower (each +1 doubles time)
const BCRYPT_ROUNDS = 12;

// User type without sensitive data (exported for use in controllers)
export interface SafeUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string): Promise<SafeUser | null> {
    // Make email case-insensitive by converting to lowercase
    const normalizedEmail = email.toLowerCase().trim();
    const user = await this.prisma.user.findFirst({
      where: {
        email: { equals: normalizedEmail, mode: 'insensitive' },
      },
    });
    if (!user) return null;

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return null;

    const { passwordHash, ...result } = user;
    return result;
  }

  async login(user: SafeUser) {
    const payload = { sub: user.id, email: user.email };
    return {
      ok: true,
      access_token: this.jwtService.sign(payload),
      user,
    };
  }

  async register(data: { email: string; password: string; firstName?: string; lastName?: string }) {
    // Normalize email to lowercase
    const normalizedEmail = data.email.toLowerCase().trim();

    const existing = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    // Use stronger bcrypt rounds for better security
    const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
      },
    });

    const { passwordHash: _, ...result } = user;
    return this.login(result);
  }
}
