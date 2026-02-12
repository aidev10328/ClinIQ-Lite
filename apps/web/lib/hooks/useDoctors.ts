'use client';

import { useQuery } from '@tanstack/react-query';
import { listDoctors, getMyAssignedDoctors, Doctor, AssignedDoctor } from '../api';
import { useAuth } from '../../components/AuthProvider';

// Query keys factory
export const doctorKeys = {
  all: ['doctors'] as const,
  list: () => [...doctorKeys.all, 'list'] as const,
  assigned: () => [...doctorKeys.all, 'assigned'] as const,
  filtered: (role: string | undefined) => [...doctorKeys.all, 'filtered', role || 'unknown'] as const,
};

// Hook to fetch all doctors list (for managers/admins)
export function useDoctors() {
  return useQuery({
    queryKey: doctorKeys.list(),
    queryFn: async () => {
      const { data, error } = await listDoctors();
      if (error) throw new Error(error.message);
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes (doctors list doesn't change often)
  });
}

// Hook to fetch assigned doctors for current user (staff only)
export function useAssignedDoctors() {
  return useQuery({
    queryKey: doctorKeys.assigned(),
    queryFn: async () => {
      const { data, error } = await getMyAssignedDoctors();
      if (error) throw new Error(error.message);
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

// Return type for useFilteredDoctors
export interface FilteredDoctorsResult {
  data: Array<{ id: string; fullName: string; hasLicense?: boolean }> | undefined;
  isLoading: boolean;
  error: Error | null;
  // The current user's doctor ID (for doctor-only users)
  currentDoctorId: string | null;
  // Whether the user can view all doctors (manager/admin only)
  canViewAllDoctors: boolean;
}

// Hook that returns doctors based on user role
// - Staff: only assigned doctors
// - Doctor: only their own doctor
// - Manager/Admin: all doctors
export function useFilteredDoctors(): FilteredDoctorsResult {
  const { clinicRole, doctorId, isManager } = useAuth();
  const isStaff = clinicRole === 'CLINIC_STAFF';
  const isDoctor = clinicRole === 'CLINIC_DOCTOR';

  // Only managers can view all doctors (show "All Doctors" option)
  const canViewAllDoctors = isManager;
  // Current doctor ID for doctor-only users
  const currentDoctorId = isDoctor ? doctorId : null;

  // Fetch all doctors (for managers/admins)
  const allDoctorsQuery = useQuery({
    queryKey: doctorKeys.list(),
    queryFn: async () => {
      const { data, error } = await listDoctors();
      if (error) throw new Error(error.message);
      return data;
    },
    staleTime: 5 * 60 * 1000,
    enabled: isManager || (!isStaff && !isDoctor),
  });

  // Fetch assigned doctors (for staff)
  const assignedDoctorsQuery = useQuery({
    queryKey: doctorKeys.assigned(),
    queryFn: async () => {
      const { data, error } = await getMyAssignedDoctors();
      if (error) throw new Error(error.message);
      return data;
    },
    staleTime: 5 * 60 * 1000,
    enabled: isStaff,
  });

  // For doctors, filter from all doctors to get their own
  const doctorQuery = useQuery({
    queryKey: doctorKeys.list(),
    queryFn: async () => {
      const { data, error } = await listDoctors();
      if (error) throw new Error(error.message);
      // Filter to only the logged-in doctor
      return data?.filter(d => d.id === doctorId) || [];
    },
    staleTime: 5 * 60 * 1000,
    enabled: isDoctor && !!doctorId,
  });

  // Determine which query to use
  if (isStaff) {
    // Convert AssignedDoctor[] to a compatible format
    const doctors = assignedDoctorsQuery.data?.map(d => ({
      id: d.id,
      fullName: d.fullName,
      hasLicense: d.hasLicense,
    })) || [];
    return {
      data: doctors as Array<{ id: string; fullName: string; hasLicense?: boolean }>,
      isLoading: assignedDoctorsQuery.isLoading,
      error: assignedDoctorsQuery.error,
      currentDoctorId: null,
      canViewAllDoctors: false,
    };
  }

  if (isDoctor) {
    return {
      data: doctorQuery.data as Array<{ id: string; fullName: string; hasLicense?: boolean }> | undefined,
      isLoading: doctorQuery.isLoading,
      error: doctorQuery.error,
      currentDoctorId,
      canViewAllDoctors: false,
    };
  }

  // Manager/Admin - return all doctors
  return {
    data: allDoctorsQuery.data as Array<{ id: string; fullName: string; hasLicense?: boolean }> | undefined,
    isLoading: allDoctorsQuery.isLoading,
    error: allDoctorsQuery.error,
    currentDoctorId: null,
    canViewAllDoctors: true,
  };
}
