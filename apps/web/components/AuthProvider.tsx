'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
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
  }

  function logout() {
    clearAllAuth();
    setUser(null);
    setClinic(null);
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
