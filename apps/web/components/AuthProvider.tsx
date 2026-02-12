'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getMe, getClinicMe, User, ClinicWithRole } from '../lib/api';
import {
  getToken,
  setToken,
  clearAllAuth,
  setClinicId,
  clearClinicId,
  isManager,
  isStaffOrManager,
  ClinicRole,
  updateLastActivity,
  isSessionExpired,
  getInactivityTimeout,
} from '../lib/auth';

type AuthContextShape = {
  user: User | null;
  clinic: ClinicWithRole | null;
  clinicId: string | null;
  loading: boolean;
  loginWithToken: (token: string) => Promise<void>;
  logout: () => void;
  refetchClinic: () => Promise<void>;
  // RBAC helpers
  isManager: boolean;
  isStaffOrManager: boolean;
  clinicRole: ClinicRole | undefined;
  // Doctor info (for CLINIC_DOCTOR users linked to a doctor record)
  doctorId: string | null;
};

const AuthContext = createContext<AuthContextShape | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [clinic, setClinic] = useState<ClinicWithRole | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchClinic = useCallback(async () => {
    const clinicRes = await getClinicMe();
    if (clinicRes.data) {
      setClinic(clinicRes.data);
      // Store clinic ID for subsequent API calls
      setClinicId(clinicRes.data.id);
    } else {
      setClinic(null);
      // Clear stale clinic ID from storage
      clearClinicId();
    }
  }, []);

  const handleLogout = useCallback(() => {
    clearAllAuth();
    setUser(null);
    setClinic(null);
    // Clear inactivity timer
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
    // Only redirect if not already on login page
    if (pathname !== '/login') {
      router.push('/login');
    }
  }, [router, pathname]);

  // Reset inactivity timer on user activity
  const resetInactivityTimer = useCallback(() => {
    // Clear existing timer
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }

    // Update last activity timestamp
    updateLastActivity();

    // Set new timer for auto-logout
    const token = getToken();
    if (token) {
      inactivityTimerRef.current = setTimeout(() => {
        handleLogout();
      }, getInactivityTimeout());
    }
  }, [handleLogout]);

  // Set up activity listeners
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];

    const handleActivity = () => {
      resetInactivityTimer();
    };

    // Only add listeners if user is logged in
    const token = getToken();
    if (token) {
      activityEvents.forEach(event => {
        window.addEventListener(event, handleActivity, { passive: true });
      });

      // Start initial inactivity timer
      resetInactivityTimer();
    }

    return () => {
      activityEvents.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, [user, resetInactivityTimer]);

  // Check for session expiry on mount and when returning to tab
  useEffect(() => {
    const checkSessionExpiry = () => {
      if (isSessionExpired() && user) {
        handleLogout();
      }
    };

    // Check on visibility change (when user returns to tab)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkSessionExpiry();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, handleLogout]);

  const fetchUserAndClinic = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setUser(null);
      setClinic(null);
      clearClinicId();
      return;
    }

    // Fetch user and clinic in parallel for faster loading
    const [userRes, clinicRes] = await Promise.all([
      getMe(),
      getClinicMe(),
    ]);

    if (userRes.error || !userRes.data) {
      // Token is invalid - clear it
      clearAllAuth();
      setUser(null);
      setClinic(null);
      return;
    }
    setUser(userRes.data);

    // Set clinic data from parallel fetch
    if (clinicRes.data) {
      setClinic(clinicRes.data);
      setClinicId(clinicRes.data.id);
    } else {
      setClinic(null);
      clearClinicId();
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await fetchUserAndClinic();
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [fetchUserAndClinic]);

  async function loginWithToken(token: string) {
    setToken(token);
    setLoading(true);
    await fetchUserAndClinic();
    setLoading(false);
    // Start inactivity timer after login
    resetInactivityTimer();
  }

  function logout() {
    handleLogout();
  }

  const clinicRole = clinic?.clinicRole;
  const platformRole = user?.role;

  const value: AuthContextShape = {
    user,
    clinic,
    clinicId: clinic?.id || null,
    loading,
    loginWithToken,
    logout,
    refetchClinic: fetchClinic,
    isManager: isManager(clinicRole, platformRole),
    isStaffOrManager: isStaffOrManager(clinicRole, platformRole),
    clinicRole,
    doctorId: clinic?.doctorId || null,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
