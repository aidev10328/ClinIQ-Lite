'use client';

import { useQuery } from '@tanstack/react-query';
import {
  getOverviewReport,
  getNoShowsReport,
  getWaitTimesReport,
  getPatientsReport,
  getQueueReport,
  getAppointmentsReport,
  getDoctorCheckinsReport,
  OverviewReportData,
  NoShowsReportData,
  WaitTimesReportData,
  PatientsReportData,
  QueueReportData,
  AppointmentsReportData,
  DoctorCheckinsData,
  PatientReportItem,
  QueueReportItem,
  AppointmentReportItem,
  DoctorCheckinItem,
} from '../api';

// Re-export types for use in components
export type {
  PatientReportItem,
  QueueReportItem,
  AppointmentReportItem,
  DoctorCheckinItem,
};

// Query keys factory
export const reportKeys = {
  all: ['reports'] as const,
  overview: (from: string, to: string, doctorId?: string) =>
    [...reportKeys.all, 'overview', from, to, doctorId || 'all'] as const,
  noShows: (from: string, to: string, doctorId?: string) =>
    [...reportKeys.all, 'no-shows', from, to, doctorId || 'all'] as const,
  waitTimes: (from: string, to: string, doctorId?: string) =>
    [...reportKeys.all, 'wait-times', from, to, doctorId || 'all'] as const,
  patients: (from?: string, to?: string, status?: string) =>
    [...reportKeys.all, 'patients', from || 'all', to || 'all', status || 'all'] as const,
  queue: (from: string, to: string, doctorId?: string, status?: string) =>
    [...reportKeys.all, 'queue', from, to, doctorId || 'all', status || 'all'] as const,
  appointments: (from: string, to: string, doctorId?: string, status?: string) =>
    [...reportKeys.all, 'appointments', from, to, doctorId || 'all', status || 'all'] as const,
  doctorCheckins: (from: string, to: string, doctorId?: string) =>
    [...reportKeys.all, 'doctor-checkins', from, to, doctorId || 'all'] as const,
};

// Hook to fetch overview report
export function useOverviewReport(from: string, to: string, doctorId?: string) {
  return useQuery({
    queryKey: reportKeys.overview(from, to, doctorId),
    queryFn: async () => {
      const { data, error } = await getOverviewReport(from, to, doctorId);
      if (error) throw new Error(error.message);
      return data;
    },
    staleTime: 60 * 1000, // 1 minute
    enabled: !!from && !!to,
  });
}

// Hook to fetch no-shows report
export function useNoShowsReport(from: string, to: string, doctorId?: string) {
  return useQuery({
    queryKey: reportKeys.noShows(from, to, doctorId),
    queryFn: async () => {
      const { data, error } = await getNoShowsReport(from, to, doctorId);
      if (error) throw new Error(error.message);
      return data;
    },
    staleTime: 60 * 1000, // 1 minute
    enabled: !!from && !!to,
  });
}

// Hook to fetch wait times report
export function useWaitTimesReport(from: string, to: string, doctorId?: string) {
  return useQuery({
    queryKey: reportKeys.waitTimes(from, to, doctorId),
    queryFn: async () => {
      const { data, error } = await getWaitTimesReport(from, to, doctorId);
      if (error) throw new Error(error.message);
      return data;
    },
    staleTime: 60 * 1000, // 1 minute
    enabled: !!from && !!to,
  });
}

// Hook to fetch patients report
export function usePatientsReport(options?: {
  from?: string;
  to?: string;
  status?: string;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: reportKeys.patients(options?.from, options?.to, options?.status),
    queryFn: async () => {
      const { data, error } = await getPatientsReport(options);
      if (error) throw new Error(error.message);
      return data;
    },
    staleTime: 60 * 1000, // 1 minute
  });
}

// Hook to fetch queue report
export function useQueueReport(from: string, to: string, options?: {
  doctorId?: string;
  status?: string;
}) {
  return useQuery({
    queryKey: reportKeys.queue(from, to, options?.doctorId, options?.status),
    queryFn: async () => {
      const { data, error } = await getQueueReport(from, to, options);
      if (error) throw new Error(error.message);
      return data;
    },
    staleTime: 60 * 1000, // 1 minute
    enabled: !!from && !!to,
  });
}

// Hook to fetch appointments report
export function useAppointmentsReport(from: string, to: string, options?: {
  doctorId?: string;
  status?: string;
}) {
  return useQuery({
    queryKey: reportKeys.appointments(from, to, options?.doctorId, options?.status),
    queryFn: async () => {
      const { data, error } = await getAppointmentsReport(from, to, options);
      if (error) throw new Error(error.message);
      return data;
    },
    staleTime: 60 * 1000, // 1 minute
    enabled: !!from && !!to,
  });
}

// Hook to fetch doctor check-ins report
export function useDoctorCheckinsReport(from: string, to: string, doctorId?: string) {
  return useQuery({
    queryKey: reportKeys.doctorCheckins(from, to, doctorId),
    queryFn: async () => {
      const { data, error } = await getDoctorCheckinsReport(from, to, doctorId);
      if (error) throw new Error(error.message);
      return data;
    },
    staleTime: 60 * 1000, // 1 minute
    enabled: !!from && !!to,
  });
}
