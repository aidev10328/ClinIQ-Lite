import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

@Injectable()
export class ManagerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const clinicRole = request.clinicRole;

    // PLATFORM_ADMIN can access manager routes
    if (clinicRole === 'PLATFORM_ADMIN') {
      return true;
    }

    // Only CLINIC_MANAGER can access manager routes
    if (clinicRole !== 'CLINIC_MANAGER') {
      throw new ForbiddenException('Manager access required');
    }

    return true;
  }
}
