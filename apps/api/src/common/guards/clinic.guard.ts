import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma.service';
import { CLINIC_ROLES_KEY, PLATFORM_ROUTE_KEY } from '../decorators/clinic.decorator';

@Injectable()
export class ClinicGuard implements CanActivate {
  constructor(
    private prisma: PrismaService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    // Check if this is a platform-only route
    const isPlatformRoute = this.reflector.getAllAndOverride<boolean>(PLATFORM_ROUTE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Platform ADMIN can access platform routes without clinic membership
    if (isPlatformRoute && user.role === 'ADMIN') {
      request.clinicId = null;
      request.clinicRole = 'PLATFORM_ADMIN';
      return true;
    }

    // Determine clinicId from header or user's clinic membership
    let clinicId = request.headers['x-clinic-id'];

    if (!clinicId) {
      // Find user's clinic memberships
      const memberships = await this.prisma.clinicUser.findMany({
        where: {
          userId: user.id,
          isActive: true,
          clinic: { isActive: true },
        },
        select: { clinicId: true, role: true },
      });

      if (memberships.length === 0) {
        throw new ForbiddenException('User is not a member of any clinic');
      }

      if (memberships.length > 1) {
        throw new BadRequestException(
          'User belongs to multiple clinics. Please specify x-clinic-id header.',
        );
      }

      clinicId = memberships[0].clinicId;
    }

    // Validate user has membership in the specified clinic
    const membership = await this.prisma.clinicUser.findFirst({
      where: {
        userId: user.id,
        clinicId: clinicId,
        isActive: true,
        clinic: { isActive: true },
      },
      select: { role: true, clinic: { select: { id: true, name: true } } },
    });

    if (!membership) {
      // Allow platform ADMIN to access any clinic
      if (user.role === 'ADMIN') {
        const clinic = await this.prisma.clinic.findUnique({
          where: { id: clinicId },
        });
        if (!clinic || !clinic.isActive) {
          throw new BadRequestException('Clinic not found or inactive');
        }
        request.clinicId = clinicId;
        request.clinicRole = 'PLATFORM_ADMIN';
        return true;
      }
      throw new ForbiddenException('User does not have access to this clinic');
    }

    // Attach clinic context to request
    request.clinicId = clinicId;
    request.clinicRole = membership.role;

    // Check role requirements if specified
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(CLINIC_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (requiredRoles && requiredRoles.length > 0) {
      // PLATFORM_ADMIN can do anything
      if (request.clinicRole === 'PLATFORM_ADMIN') {
        return true;
      }

      if (!requiredRoles.includes(membership.role)) {
        throw new ForbiddenException(
          `This action requires one of these roles: ${requiredRoles.join(', ')}`,
        );
      }
    }

    return true;
  }
}
