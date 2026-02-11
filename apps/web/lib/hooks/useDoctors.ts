'use client';

import { useQuery } from '@tanstack/react-query';
import { listDoctors, Doctor } from '../api';

// Query keys factory
export const doctorKeys = {
  all: ['doctors'] as const,
  list: () => [...doctorKeys.all, 'list'] as const,
};

// Hook to fetch doctors list
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
