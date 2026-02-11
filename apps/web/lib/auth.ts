'use client';

const TOKEN_KEY = 'cliniq-lite_token';
const CLINIC_ID_KEY = 'cliniq-lite_clinic_id';

// Token management
export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // ignore localStorage errors
  }
}

export function clearToken(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore localStorage errors
  }
}

// Clinic ID management
export function getClinicId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(CLINIC_ID_KEY);
  } catch {
    return null;
  }
}

export function setClinicId(clinicId: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CLINIC_ID_KEY, clinicId);
  } catch {
    // ignore localStorage errors
  }
}

export function clearClinicId(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(CLINIC_ID_KEY);
  } catch {
    // ignore localStorage errors
  }
}

// Clear all auth data
export function clearAllAuth(): void {
  clearToken();
  clearClinicId();
}

// RBAC helpers
export type ClinicRole = 'CLINIC_MANAGER' | 'CLINIC_DOCTOR' | 'CLINIC_STAFF';
export type PlatformRole = 'ADMIN' | 'USER' | 'VIEWER';

export function isManager(clinicRole?: ClinicRole, platformRole?: PlatformRole): boolean {
  return clinicRole === 'CLINIC_MANAGER' || platformRole === 'ADMIN';
}

export function isStaffOrManager(clinicRole?: ClinicRole, platformRole?: PlatformRole): boolean {
  return clinicRole === 'CLINIC_MANAGER' || clinicRole === 'CLINIC_DOCTOR' || clinicRole === 'CLINIC_STAFF' || platformRole === 'ADMIN';
}
