'use client';

import { useQuery } from '@tanstack/react-query';
import {
  getOverviewReport,
  getNoShowsReport,
  getWaitTimesReport,
  OverviewReportData,
  NoShowsReportData,
  WaitTimesReportData,
} from '../api';

// Query keys factory
export const reportKeys = {
  all: ['reports'] as const,
  overview: (from: string, to: string, doctorId?: string) =>
    [...reportKeys.all, 'overview', from, to, doctorId || 'all'] as const,
  noShows: (from: string, to: string, doctorId?: string) =>
    [...reportKeys.all, 'no-shows', from, to, doctorId || 'all'] as const,
  waitTimes: (from: string, to: string, doctorId?: string) =>
    [...reportKeys.all, 'wait-times', from, to, doctorId || 'all'] as const,
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
