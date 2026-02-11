'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getStaffDashboard,
  getDoctorDashboard,
  getManagerDashboard,
  checkinAppointment,
  markAppointmentNoShow,
  updateQueueStatus,
  StaffDashboardData,
  DoctorDashboardData,
  ManagerDashboardData,
  QueueEntry,
  Appointment,
  QueueStatus,
} from '../api';

// Query keys factory
export const dashboardKeys = {
  all: ['dashboard'] as const,
  staff: (date: string, doctorId?: string) =>
    [...dashboardKeys.all, 'staff', date, doctorId || 'all'] as const,
  doctor: (date: string, doctorId?: string) =>
    [...dashboardKeys.all, 'doctor', date, doctorId || 'self'] as const,
  manager: (from: string, to: string, doctorId?: string) =>
    [...dashboardKeys.all, 'manager', from, to, doctorId || 'all'] as const,
};

// Hook to fetch staff dashboard
export function useStaffDashboard(date: string, doctorId?: string) {
  return useQuery({
    queryKey: dashboardKeys.staff(date, doctorId),
    queryFn: async () => {
      const { data, error } = await getStaffDashboard(date, doctorId);
      if (error) throw new Error(error.message);
      return data;
    },
    staleTime: 30 * 1000, // 30 seconds - data is fresh for 30s
    refetchInterval: 60 * 1000, // Auto-refresh every 60 seconds (reduced from 30s)
    refetchIntervalInBackground: false,
  });
}

// Mutation for checking in appointment (invalidates dashboard)
export function useCheckinFromDashboard(date: string, doctorId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (appointmentId: string) => {
      const { data, error } = await checkinAppointment(appointmentId);
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: dashboardKeys.staff(date, doctorId),
      });
    },
  });
}

// Mutation for marking appointment as no-show (invalidates dashboard)
export function useNoShowFromDashboard(date: string, doctorId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (appointmentId: string) => {
      const { data, error } = await markAppointmentNoShow(appointmentId);
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: dashboardKeys.staff(date, doctorId),
      });
    },
  });
}

// ============================================
// Doctor Dashboard Hooks
// ============================================

// Hook to fetch doctor dashboard
export function useDoctorDashboard(date: string, doctorId?: string) {
  return useQuery({
    queryKey: dashboardKeys.doctor(date, doctorId),
    queryFn: async () => {
      const { data, error } = await getDoctorDashboard(date, doctorId);
      if (error) throw new Error(error.message);
      return data;
    },
    staleTime: 20 * 1000, // 20 seconds
    refetchInterval: 30 * 1000, // Auto-refresh every 30 seconds (reduced from 15s)
    refetchIntervalInBackground: false,
  });
}

// Mutation to call next patient (QUEUED/WAITING -> WITH_DOCTOR)
export function useCallPatient(date: string, doctorId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (queueEntryId: string) => {
      const { data, error } = await updateQueueStatus(queueEntryId, 'WITH_DOCTOR');
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: dashboardKeys.doctor(date, doctorId),
      });
      queryClient.invalidateQueries({
        queryKey: dashboardKeys.staff(date, doctorId),
      });
    },
  });
}

// Mutation to complete consultation (WITH_DOCTOR -> COMPLETED, outcome=DONE)
export function useCompleteConsultation(date: string, doctorId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (queueEntryId: string) => {
      const { data, error } = await updateQueueStatus(queueEntryId, 'COMPLETED', 'DONE');
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: dashboardKeys.doctor(date, doctorId),
      });
      queryClient.invalidateQueries({
        queryKey: dashboardKeys.staff(date, doctorId),
      });
    },
  });
}

// Mutation to mark patient as no-show from queue (WITH_DOCTOR -> COMPLETED, outcome=NO_SHOW)
export function useQueueNoShow(date: string, doctorId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (queueEntryId: string) => {
      const { data, error } = await updateQueueStatus(queueEntryId, 'COMPLETED', 'NO_SHOW');
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: dashboardKeys.doctor(date, doctorId),
      });
      queryClient.invalidateQueries({
        queryKey: dashboardKeys.staff(date, doctorId),
      });
    },
  });
}

// ============================================
// Manager Dashboard Hooks
// ============================================

// Hook to fetch manager dashboard
export function useManagerDashboard(from: string, to: string, doctorId?: string) {
  return useQuery({
    queryKey: dashboardKeys.manager(from, to, doctorId),
    queryFn: async () => {
      const { data, error } = await getManagerDashboard(from, to, doctorId);
      if (error) throw new Error(error.message);
      return data;
    },
    staleTime: 60 * 1000, // 1 minute (analytics data doesn't need frequent updates)
    refetchInterval: 5 * 60 * 1000, // Auto-refresh every 5 minutes
    refetchIntervalInBackground: false,
  });
}
