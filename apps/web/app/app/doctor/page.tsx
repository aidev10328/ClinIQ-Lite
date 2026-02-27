'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../../components/AuthProvider';
import StatCard from '../../../components/StatCard';
import {
  useDoctorDashboard,
  useCallPatient,
  useCompleteConsultation,
  useQueueNoShow,
} from '../../../lib/hooks/useDashboardData';

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatElapsedTime(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

// Real-time timer component for current patient
function ConsultTimer({ startedAt }: { startedAt: string }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = new Date(startedAt).getTime();

    const updateElapsed = () => {
      const now = Date.now();
      setElapsed(Math.floor((now - start) / 1000));
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  return (
    <span className="font-mono text-2xl font-bold text-primary-600">
      {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
    </span>
  );
}

export default function DoctorDashboardPage() {
  const { user, clinic, clinicId } = useAuth();
  const [selectedDate] = useState(() => formatDate(new Date()));

  // Fetch doctor dashboard
  const {
    data: dashboard,
    isLoading,
    error,
    refetch,
  } = useDoctorDashboard(selectedDate);

  // Mutations
  const callMutation = useCallPatient(selectedDate);
  const completeMutation = useCompleteConsultation(selectedDate);
  const noShowMutation = useQueueNoShow(selectedDate);

  const handleCallPatient = async (queueEntryId: string) => {
    try {
      await callMutation.mutateAsync(queueEntryId);
    } catch {
      // Error is handled by mutation's onError/error state
    }
  };

  const handleComplete = async () => {
    if (!dashboard?.now) return;
    try {
      await completeMutation.mutateAsync(dashboard.now.queueEntryId);
    } catch {
      // Error is handled by mutation's onError/error state
    }
  };

  const handleNoShow = async () => {
    if (!dashboard?.now) return;
    try {
      await noShowMutation.mutateAsync(dashboard.now.queueEntryId);
    } catch {
      // Error is handled by mutation's onError/error state
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="page-title text-xl sm:text-2xl">Doctor Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            {dashboard?.doctor?.fullName || 'Loading...'} • {clinic?.name}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
            })}
          </span>
          <button
            onClick={() => refetch()}
            disabled={isLoading}
            className="btn-secondary text-sm !py-2"
          >
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div className="alert-error mb-6">
          {error.message}
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <StatCard
          value={isLoading ? '...' : dashboard?.stats.seen ?? 0}
          label="Seen Today"
          color="success"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard
          value={isLoading ? '...' : dashboard?.stats.waiting ?? 0}
          label="Waiting"
          color="warning"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard
          value={isLoading ? '...' : `${dashboard?.stats.avgWaitMin ?? 0}m`}
          label="Avg Wait"
          color="gray"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard
          value={isLoading ? '...' : `${dashboard?.stats.avgConsultMin ?? 0}m`}
          label="Avg Consult"
          color="primary"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          }
        />
        <StatCard
          value={isLoading ? '...' : `${dashboard?.stats.noShowRate ?? 0}%`}
          label="No-Show Rate"
          color={dashboard?.stats.noShowRate && dashboard.stats.noShowRate > 10 ? 'warning' : 'gray'}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          }
        />
      </div>

      {/* Current Patient (NOW) */}
      <div className="card mb-6">
        <h2 className="text-lg font-heading font-semibold text-gray-900 mb-4">
          Current Patient
        </h2>

        {isLoading ? (
          <div className="text-gray-500 text-sm py-8 text-center">Loading...</div>
        ) : dashboard?.now ? (
          <div className="bg-gradient-to-r from-primary-50 to-green-50 border border-primary-200 rounded-xl p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center">
                  <span className="text-2xl font-bold text-primary-700">
                    {dashboard.now.queueNumber}
                  </span>
                </div>
                <div>
                  <p className="text-xl font-semibold text-gray-900">
                    {dashboard.now.patientName}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-gray-500">Consultation time:</span>
                    <ConsultTimer startedAt={dashboard.now.startedAt} />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleComplete}
                  disabled={completeMutation.isPending}
                  className="btn-primary !py-3 !px-6"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {completeMutation.isPending ? 'Completing...' : 'Completed'}
                </button>
                <button
                  onClick={handleNoShow}
                  disabled={noShowMutation.isPending}
                  className="btn-secondary !py-3 !px-4 text-red-600 hover:text-red-700 hover:border-red-300"
                  title="Mark as No-Show"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 bg-gray-50 rounded-xl">
            <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <p className="text-gray-500 font-medium">No patient currently</p>
            <p className="text-sm text-gray-400 mt-1">Call the next patient from the waiting list</p>
          </div>
        )}
      </div>

      {/* Next Up - Waiting List */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-heading font-semibold text-gray-900">
            Next Up
          </h2>
          {dashboard?.waitingNext && dashboard.waitingNext.length > 0 && (
            <span className="text-sm text-gray-500">
              {dashboard.waitingNext.length} waiting
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="text-gray-500 text-sm py-4">Loading...</div>
        ) : !dashboard?.waitingNext || dashboard.waitingNext.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-lg">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-gray-500">No patients waiting</p>
          </div>
        ) : (
          <div className="space-y-3">
            {dashboard.waitingNext.map((patient, index) => (
              <div
                key={patient.queueEntryId}
                className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                  index === 0 && !dashboard.now
                    ? 'bg-green-50 border-green-200'
                    : 'bg-gray-50 border-gray-100'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    index === 0 && !dashboard.now
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-200 text-gray-600'
                  }`}>
                    <span className="font-bold">{patient.queueNumber}</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{patient.patientName}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-sm text-gray-500">
                        Waiting {formatElapsedTime(patient.minutesWaiting)}
                      </span>
                      {patient.priority !== 'NORMAL' && (
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          patient.priority === 'EMERGENCY'
                            ? 'bg-red-100 text-red-700'
                            : patient.priority === 'URGENT'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {patient.priority}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleCallPatient(patient.queueEntryId)}
                  disabled={callMutation.isPending || !!dashboard.now}
                  className={`btn-primary text-sm !py-2 !px-4 ${
                    dashboard.now ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  title={dashboard.now ? 'Complete current patient first' : 'Call patient'}
                >
                  <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                  </svg>
                  Call
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* User Info */}
      <div className="mt-8 p-4 bg-gray-50 rounded-lg">
        <div className="flex flex-wrap gap-4 text-sm text-gray-600">
          <div>
            <span className="text-gray-400">Logged in as:</span>{' '}
            <span className="font-medium">{user?.firstName || user?.email}</span>
          </div>
          <div>
            <span className="text-gray-400">Auto-refresh:</span>{' '}
            <span className="font-medium">Every 15s</span>
          </div>
        </div>
      </div>
    </div>
  );
}
