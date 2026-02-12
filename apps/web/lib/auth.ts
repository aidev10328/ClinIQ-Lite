'use client';

const TOKEN_KEY = 'cliniq-lite_token';
const CLINIC_ID_KEY = 'cliniq-lite_clinic_id';
const LAST_ACTIVITY_KEY = 'cliniq-lite_last_activity';
const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes in milliseconds

// Token management - using sessionStorage so token is cleared when browser closes
export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    // Check if session has expired due to inactivity
    if (isSessionExpired()) {
      clearAllAuth();
      return null;
    }
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
    updateLastActivity(); // Set initial activity timestamp
  } catch {
    // ignore sessionStorage errors
  }
}

export function clearToken(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore sessionStorage errors
  }
}

// Clinic ID management
export function getClinicId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem(CLINIC_ID_KEY);
  } catch {
    return null;
  }
}

export function setClinicId(clinicId: string): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(CLINIC_ID_KEY, clinicId);
  } catch {
    // ignore sessionStorage errors
  }
}

export function clearClinicId(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(CLINIC_ID_KEY);
  } catch {
    // ignore sessionStorage errors
  }
}

// Last activity tracking for inactivity timeout
export function updateLastActivity(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
  } catch {
    // ignore sessionStorage errors
  }
}

export function getLastActivity(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const lastActivity = sessionStorage.getItem(LAST_ACTIVITY_KEY);
    return lastActivity ? parseInt(lastActivity, 10) : null;
  } catch {
    return null;
  }
}

export function isSessionExpired(): boolean {
  const lastActivity = getLastActivity();
  if (!lastActivity) return false;

  const now = Date.now();
  return (now - lastActivity) > INACTIVITY_TIMEOUT_MS;
}

export function clearLastActivity(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(LAST_ACTIVITY_KEY);
  } catch {
    // ignore sessionStorage errors
  }
}

// Clear all auth data
export function clearAllAuth(): void {
  clearToken();
  clearClinicId();
  clearLastActivity();
}

// Get inactivity timeout in ms
export function getInactivityTimeout(): number {
  return INACTIVITY_TIMEOUT_MS;
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
