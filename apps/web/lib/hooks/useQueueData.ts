'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listDoctors,
  getDoctor,
  listQueue,
  listAppointments,
  updateQueueStatus,
  checkinAppointment,
  markAppointmentNoShow,
  createWalkin,
  getClinicTime,
  QueueEntry,
  QueueStatus,
  QueueOutcome,
  QueuePriority,
  Appointment,
  ClinicTime,
} from '../api';

// Query keys factory
export const queueKeys = {
  all: ['queue'] as const,
  clinicTime: () => [...queueKeys.all, 'clinicTime'] as const,
  doctors: () => [...queueKeys.all, 'doctors'] as const,
  doctor: (id: string) => [...queueKeys.all, 'doctor', id] as const,
  entries: (date: string, doctorId: string) =>
    [...queueKeys.all, 'entries', date, doctorId] as const,
  appointments: (date: string, doctorId: string) =>
    [...queueKeys.all, 'appointments', date, doctorId] as const,
};

// Hook to fetch clinic time (current date in clinic timezone)
export function useClinicTime() {
  return useQuery({
    queryKey: queueKeys.clinicTime(),
    queryFn: async () => {
      const { data, error } = await getClinicTime();
      if (error) throw new Error(error.message);
      return data;
    },
    staleTime: 60 * 1000, // 1 minute - time doesn't change that fast
    refetchInterval: 60 * 1000, // Refetch every minute to keep time current
  });
}

// Hook to fetch doctors list
export function useDoctors() {
  return useQuery({
    queryKey: queueKeys.doctors(),
    queryFn: async () => {
      const { data, error } = await listDoctors();
      if (error) throw new Error(error.message);
      return data || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Hook to fetch single doctor details
export function useDoctor(doctorId: string | null) {
  return useQuery({
    queryKey: queueKeys.doctor(doctorId || ''),
    queryFn: async () => {
      if (!doctorId) return null;
      const { data, error } = await getDoctor(doctorId);
      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!doctorId,
    staleTime: 5 * 60 * 1000,
  });
}

// Hook to fetch queue entries with polling
// Uses clinic timezone for date (not browser time)
export function useQueueEntries(
  doctorId: string | null,
  options?: { pollingEnabled?: boolean; date?: string }
) {
  // Fetch clinic time to get correct date in clinic timezone
  const { data: clinicTime } = useClinicTime();
  const today = options?.date || clinicTime?.currentDate || '';

  return useQuery({
    queryKey: queueKeys.entries(today, doctorId || ''),
    queryFn: async () => {
      if (!doctorId || !today) return [];
      const { data, error } = await listQueue(today, doctorId);
      if (error) throw new Error(error.message);
      return data || [];
    },
    enabled: !!doctorId && !!today,
    staleTime: 10 * 1000, // 10 seconds for queue data
    refetchInterval: options?.pollingEnabled ? 15000 : false, // Reduced from 5s to 15s
    refetchIntervalInBackground: false, // Don't poll when tab is hidden
  });
}

// Hook to fetch appointments with polling
// Uses clinic timezone for date (not browser time)
export function useAppointments(
  doctorId: string | null,
  options?: { pollingEnabled?: boolean; date?: string }
) {
  // Fetch clinic time to get correct date in clinic timezone
  const { data: clinicTime } = useClinicTime();
  const today = options?.date || clinicTime?.currentDate || '';

  return useQuery({
    queryKey: queueKeys.appointments(today, doctorId || ''),
    queryFn: async () => {
      if (!doctorId || !today) return [];
      const { data, error } = await listAppointments(today, doctorId);
      if (error) throw new Error(error.message);
      return data || [];
    },
    enabled: !!doctorId && !!today,
    staleTime: 10 * 1000, // 10 seconds
    refetchInterval: options?.pollingEnabled ? 15000 : false, // Reduced from 5s to 15s
    refetchIntervalInBackground: false,
  });
}

// Mutation for updating queue status with optimistic updates
// Uses clinic timezone for cache key
export function useUpdateQueueStatus(doctorId: string | null, clinicDate?: string) {
  const queryClient = useQueryClient();
  const { data: clinicTime } = useClinicTime();
  const today = clinicDate || clinicTime?.currentDate || '';

  return useMutation({
    mutationFn: async ({
      entryId,
      newStatus,
      outcome,
    }: {
      entryId: string;
      newStatus: QueueStatus;
      outcome?: QueueOutcome;
    }) => {
      const { data, error } = await updateQueueStatus(entryId, newStatus, outcome);
      if (error) throw new Error(error.message);
      return data;
    },
    onMutate: async ({ entryId, newStatus, outcome }) => {
      if (!today) return {};
      const entriesKey = queueKeys.entries(today, doctorId || '');

      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: entriesKey });

      // Snapshot previous value
      const previousEntries = queryClient.getQueryData<QueueEntry[]>(entriesKey);

      // Optimistically update
      if (previousEntries) {
        queryClient.setQueryData<QueueEntry[]>(entriesKey, (old) =>
          old?.map((entry) =>
            entry.id === entryId
              ? {
                  ...entry,
                  status: newStatus,
                  ...(outcome ? { outcome } : {}),
                  ...(newStatus === 'WITH_DOCTOR' && !entry.startedAt
                    ? { startedAt: new Date().toISOString() }
                    : {}),
                  ...(newStatus === 'COMPLETED' && !entry.completedAt
                    ? { completedAt: new Date().toISOString() }
                    : {}),
                }
              : entry
          )
        );
      }

      return { previousEntries, entriesKey };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousEntries && context?.entriesKey) {
        queryClient.setQueryData(context.entriesKey, context.previousEntries);
      }
    },
    onSettled: () => {
      if (!today) return;
      // Always refetch after mutation
      queryClient.invalidateQueries({ queryKey: queueKeys.entries(today, doctorId || '') });
    },
  });
}

// Mutation for checking in appointment
// Uses clinic timezone for cache key
export function useCheckinAppointment(doctorId: string | null, clinicDate?: string) {
  const queryClient = useQueryClient();
  const { data: clinicTime } = useClinicTime();
  const today = clinicDate || clinicTime?.currentDate || '';

  return useMutation({
    mutationFn: async (appointmentId: string) => {
      const { data, error } = await checkinAppointment(appointmentId);
      if (error) throw new Error(error.message);
      return data;
    },
    onMutate: async (appointmentId) => {
      if (!today) return {};
      const appointmentsKey = queueKeys.appointments(today, doctorId || '');
      const entriesKey = queueKeys.entries(today, doctorId || '');

      await queryClient.cancelQueries({ queryKey: appointmentsKey });
      await queryClient.cancelQueries({ queryKey: entriesKey });

      const previousAppointments =
        queryClient.getQueryData<Appointment[]>(appointmentsKey);
      const previousEntries =
        queryClient.getQueryData<QueueEntry[]>(entriesKey);

      // Find the appointment being checked in
      const appointment = previousAppointments?.find(
        (appt) => appt.id === appointmentId
      );

      // Optimistically remove from scheduled list
      if (previousAppointments) {
        queryClient.setQueryData<Appointment[]>(appointmentsKey, (old) =>
          old?.filter((appt) => appt.id !== appointmentId)
        );
      }

      // Optimistically add to queue entries
      if (previousEntries && appointment) {
        const queuedEntries = previousEntries.filter((e) => e.status === 'QUEUED');
        const newPosition = queuedEntries.length + 1;

        const optimisticEntry: QueueEntry = {
          id: `temp-${appointmentId}`, // Temporary ID
          clinicId: appointment.clinicId,
          patientId: appointment.patientId,
          doctorId: appointment.doctorId,
          queueDate: today,
          position: newPosition,
          priority: 'NORMAL',
          status: 'QUEUED',
          source: 'APPOINTMENT',
          reason: appointment.reason,
          checkedInAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          patient: appointment.patient,
          doctor: appointment.doctor,
        };

        queryClient.setQueryData<QueueEntry[]>(entriesKey, (old) =>
          old ? [...old, optimisticEntry] : [optimisticEntry]
        );
      }

      return { previousAppointments, previousEntries, appointmentsKey, entriesKey };
    },
    onError: (err, appointmentId, context) => {
      if (context?.appointmentsKey && context?.previousAppointments) {
        queryClient.setQueryData(context.appointmentsKey, context.previousAppointments);
      }
      if (context?.entriesKey && context?.previousEntries) {
        queryClient.setQueryData(context.entriesKey, context.previousEntries);
      }
    },
    onSettled: () => {
      if (!today) return;
      // Invalidate both queue and appointments
      queryClient.invalidateQueries({
        queryKey: queueKeys.entries(today, doctorId || ''),
      });
      queryClient.invalidateQueries({
        queryKey: queueKeys.appointments(today, doctorId || ''),
      });
    },
  });
}

// Mutation for marking appointment as no-show
// Uses clinic timezone for cache key
export function useMarkNoShow(doctorId: string | null, clinicDate?: string) {
  const queryClient = useQueryClient();
  const { data: clinicTime } = useClinicTime();
  const today = clinicDate || clinicTime?.currentDate || '';

  return useMutation({
    mutationFn: async (appointmentId: string) => {
      const { data, error } = await markAppointmentNoShow(appointmentId);
      if (error) throw new Error(error.message);
      return data;
    },
    onMutate: async (appointmentId) => {
      if (!today) return {};
      const appointmentsKey = queueKeys.appointments(today, doctorId || '');
      await queryClient.cancelQueries({ queryKey: appointmentsKey });

      const previousAppointments =
        queryClient.getQueryData<Appointment[]>(appointmentsKey);

      // Optimistically remove from scheduled list (will appear in completed via queue entry)
      if (previousAppointments) {
        queryClient.setQueryData<Appointment[]>(appointmentsKey, (old) =>
          old?.filter((appt) => appt.id !== appointmentId)
        );
      }

      return { previousAppointments, appointmentsKey };
    },
    onError: (err, appointmentId, context) => {
      if (context?.appointmentsKey && context?.previousAppointments) {
        queryClient.setQueryData(context.appointmentsKey, context.previousAppointments);
      }
    },
    onSettled: () => {
      if (!today) return;
      // Invalidate both queue and appointments (no-show creates a completed queue entry)
      queryClient.invalidateQueries({
        queryKey: queueKeys.entries(today, doctorId || ''),
      });
      queryClient.invalidateQueries({
        queryKey: queueKeys.appointments(today, doctorId || ''),
      });
    },
  });
}

// Mutation for creating walk-in with optimistic updates
// Uses clinic timezone for cache key
export function useCreateWalkin(doctorId: string | null, clinicDate?: string) {
  const queryClient = useQueryClient();
  const { data: clinicTime } = useClinicTime();
  const today = clinicDate || clinicTime?.currentDate || '';

  return useMutation({
    mutationFn: async (data: {
      doctorId: string;
      patientName: string;
      patientPhone: string;
      priority?: QueuePriority;
      reason?: string;
    }) => {
      const { data: result, error } = await createWalkin(data);
      if (error) throw new Error(error.message);
      return result;
    },
    onMutate: async (data) => {
      if (!today) return {};
      const entriesKey = queueKeys.entries(today, doctorId || '');
      await queryClient.cancelQueries({ queryKey: entriesKey });

      const previousEntries = queryClient.getQueryData<QueueEntry[]>(entriesKey);

      // Optimistically add to queue entries
      if (previousEntries) {
        const queuedEntries = previousEntries.filter((e) => e.status === 'QUEUED');
        const newPosition = queuedEntries.length + 1;

        const optimisticEntry: QueueEntry = {
          id: `temp-walkin-${Date.now()}`,
          clinicId: '',
          patientId: '',
          doctorId: data.doctorId,
          queueDate: today,
          position: newPosition,
          priority: data.priority || 'NORMAL',
          status: 'QUEUED',
          source: 'WALKIN',
          reason: data.reason,
          checkedInAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          patient: {
            id: '',
            fullName: data.patientName,
            phone: data.patientPhone,
          },
          doctor: {
            id: data.doctorId,
            fullName: '',
          },
        };

        queryClient.setQueryData<QueueEntry[]>(entriesKey, (old) =>
          old ? [...old, optimisticEntry] : [optimisticEntry]
        );
      }

      return { previousEntries, entriesKey };
    },
    onError: (err, data, context) => {
      if (context?.entriesKey && context?.previousEntries) {
        queryClient.setQueryData(context.entriesKey, context.previousEntries);
      }
    },
    onSettled: () => {
      if (!today) return;
      queryClient.invalidateQueries({
        queryKey: queueKeys.entries(today, doctorId || ''),
      });
      // Also invalidate patients query since walk-in may create new patient
      queryClient.invalidateQueries({
        queryKey: ['patients'],
      });
    },
  });
}
