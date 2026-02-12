import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';

// Get clinicId from request (set by ClinicGuard)
export const ClinicId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request.clinicId;
  },
);

// Get clinic role from request (set by ClinicGuard)
export const ClinicRole = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request.clinicRole;
  },
);

// Get clinic user ID from request (set by ClinicGuard)
export const ClinicUserId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string | null => {
    const request = ctx.switchToHttp().getRequest();
    return request.clinicUserId || null;
  },
);

// Get doctor ID from request (set by ClinicGuard for CLINIC_DOCTOR role)
export const DoctorId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string | null => {
    const request = ctx.switchToHttp().getRequest();
    return request.doctorId || null;
  },
);

// Get current user from request
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);

// Decorator for required clinic roles
export const CLINIC_ROLES_KEY = 'clinic_roles';
export const ClinicRoles = (...roles: string[]) => SetMetadata(CLINIC_ROLES_KEY, roles);

// Decorator to mark route as platform-only (ADMIN bypass)
export const PLATFORM_ROUTE_KEY = 'platform_route';
export const PlatformRoute = () => SetMetadata(PLATFORM_ROUTE_KEY, true);
