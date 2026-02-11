'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '../../../components/AuthProvider';
import StatCard from '../../../components/StatCard';
import { useStaffDashboard, useCheckinFromDashboard, useNoShowFromDashboard, useManagerDashboard, useDoctorDashboard, useCallPatient, useCompleteConsultation, useQueueNoShow } from '../../../lib/hooks/useDashboardData';
import { useClinicTime } from '../../../lib/hooks/useQueueData';
import { listDoctors, Doctor } from '../../../lib/api';
import { useQuery } from '@tanstack/react-query';

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatTime(timeStr: string): string {
  // timeStr is like "09:30" or ISO timestamp
  if (timeStr.includes('T')) {
    return new Date(timeStr).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }
  // HH:MM format
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

function getDefaultDateRange(): { from: string; to: string } {
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 6);
  return {
    from: formatDate(weekAgo),
    to: formatDate(today),
  };
}

function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function DashboardPage() {
  const { isManager, clinicRole, user } = useAuth();

  // Managers see Manager Dashboard
  if (isManager) {
    return <ManagerDashboard />;
  }

  // Doctors (non-manager) see Doctor Dashboard with their own data
  if (clinicRole === 'CLINIC_DOCTOR') {
    return <DoctorDashboard />;
  }

  // Staff see Staff Dashboard
  return <StaffDashboard />;
}

// Manager Dashboard Component
function ManagerDashboard() {
  const { user, clinic, isManager } = useAuth();
  const [dateRange, setDateRange] = useState(getDefaultDateRange);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');

  // Fetch doctors for dropdown
  const { data: doctors } = useQuery({
    queryKey: ['doctors'],
    queryFn: async () => {
      const { data, error } = await listDoctors();
      if (error) throw new Error(error.message);
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch manager dashboard
  const {
    data: dashboard,
    isLoading,
    error,
    refetch,
  } = useManagerDashboard(dateRange.from, dateRange.to, selectedDoctorId || undefined);

  // Quick date range presets
  const setPreset = (days: number) => {
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - (days - 1));
    setDateRange({
      from: formatDate(start),
      to: formatDate(today),
    });
  };

  // Calculate max values for visual indicators
  const maxVolume = useMemo(() => {
    if (!dashboard?.byDoctor) return 0;
    return Math.max(...dashboard.byDoctor.map(d => d.total), 1);
  }, [dashboard]);

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="page-title text-xl sm:text-2xl">Manager Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            {clinic?.name} - Analytics & Performance
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isLoading}
          className="btn-secondary text-sm !py-2"
        >
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex flex-wrap items-center gap-4">
          {/* Date range presets */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Quick:</span>
            <div className="flex gap-1">
              {[
                { label: '7D', days: 7 },
                { label: '14D', days: 14 },
                { label: '30D', days: 30 },
              ].map(({ label, days }) => (
                <button
                  key={days}
                  onClick={() => setPreset(days)}
                  className="px-3 py-1 text-sm rounded-md border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="h-6 border-l border-gray-200" />

          {/* Custom date range */}
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
              className="input-field text-sm !py-1.5"
            />
            <span className="text-gray-400">to</span>
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
              className="input-field text-sm !py-1.5"
            />
          </div>

          <div className="h-6 border-l border-gray-200" />

          {/* Doctor filter */}
          <select
            value={selectedDoctorId}
            onChange={(e) => setSelectedDoctorId(e.target.value)}
            className="input-field text-sm !py-1.5 min-w-[150px]"
          >
            <option value="">All Doctors</option>
            {doctors?.map((doc: Doctor) => (
              <option key={doc.id} value={doc.id}>
                {doc.fullName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="alert-error mb-6">
          {error.message}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <StatCard
          value={isLoading ? '...' : dashboard?.kpis.totalAppointments ?? 0}
          label="Total Appointments"
          color="primary"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          }
        />
        <StatCard
          value={isLoading ? '...' : `${dashboard?.kpis.completionPct ?? 0}%`}
          label="Completion Rate"
          color="success"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard
          value={isLoading ? '...' : `${dashboard?.kpis.noShowRate ?? 0}%`}
          label="No-Show Rate"
          color={dashboard?.kpis.noShowRate && dashboard.kpis.noShowRate > 10 ? 'warning' : 'gray'}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          }
        />
        <StatCard
          value={isLoading ? '...' : `${dashboard?.kpis.avgWaitMin ?? 0}m`}
          label="Avg Wait Time"
          color={dashboard?.kpis.avgWaitMin && dashboard.kpis.avgWaitMin > 20 ? 'warning' : 'gray'}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard
          value={isLoading ? '...' : `${dashboard?.kpis.avgConsultMin ?? 0}m`}
          label="Avg Consult Time"
          color="primary"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          }
        />
        <StatCard
          value={isLoading ? '...' : `${dashboard?.kpis.walkinPct ?? 0}%`}
          label="Walk-in Rate"
          color="gray"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          }
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* By Doctor Table */}
        <div className="card">
          <h2 className="text-lg font-heading font-semibold text-gray-900 mb-4">
            Performance by Doctor
          </h2>

          {isLoading ? (
            <div className="text-gray-500 text-sm py-4">Loading...</div>
          ) : !dashboard?.byDoctor || dashboard.byDoctor.length === 0 ? (
            <div className="text-gray-500 text-sm py-4">No data for selected period.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-2 font-medium text-gray-600">Doctor</th>
                    <th className="text-center py-2 px-2 font-medium text-gray-600">Volume</th>
                    <th className="text-center py-2 px-2 font-medium text-gray-600">Utilization</th>
                    <th className="text-center py-2 px-2 font-medium text-gray-600">Avg Wait</th>
                    <th className="text-center py-2 px-2 font-medium text-gray-600">No-Show</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.byDoctor.map((doc) => (
                    <tr key={doc.doctorId} className="border-b border-gray-100 last:border-0">
                      <td className="py-3 px-2">
                        <span className="font-medium text-gray-900">{doc.doctorName}</span>
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-16 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-primary-500 h-2 rounded-full"
                              style={{ width: `${(doc.total / maxVolume) * 100}%` }}
                            />
                          </div>
                          <span className="text-gray-600 w-8 text-right">{doc.total}</span>
                        </div>
                      </td>
                      <td className="py-3 px-2 text-center">
                        <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-medium ${
                          doc.utilizationPct >= 80
                            ? 'bg-green-100 text-green-700'
                            : doc.utilizationPct >= 50
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {doc.utilizationPct}%
                        </span>
                      </td>
                      <td className="py-3 px-2 text-center">
                        <span className={doc.avgWaitMin > 20 ? 'text-amber-600' : 'text-gray-600'}>
                          {doc.avgWaitMin}m
                        </span>
                      </td>
                      <td className="py-3 px-2 text-center">
                        <span className={doc.noShowRate > 10 ? 'text-red-600' : 'text-gray-600'}>
                          {doc.noShowRate}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* By Day Table */}
        <div className="card">
          <h2 className="text-lg font-heading font-semibold text-gray-900 mb-4">
            Daily Breakdown
          </h2>

          {isLoading ? (
            <div className="text-gray-500 text-sm py-4">Loading...</div>
          ) : !dashboard?.byDay || dashboard.byDay.length === 0 ? (
            <div className="text-gray-500 text-sm py-4">No data for selected period.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-2 font-medium text-gray-600">Date</th>
                    <th className="text-center py-2 px-2 font-medium text-gray-600">Appts</th>
                    <th className="text-center py-2 px-2 font-medium text-gray-600">Done</th>
                    <th className="text-center py-2 px-2 font-medium text-gray-600">No-Show</th>
                    <th className="text-center py-2 px-2 font-medium text-gray-600">Wait</th>
                    <th className="text-center py-2 px-2 font-medium text-gray-600">Consult</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.byDay.map((day) => (
                    <tr key={day.date} className="border-b border-gray-100 last:border-0">
                      <td className="py-3 px-2">
                        <span className="font-medium text-gray-900">{formatDateShort(day.date)}</span>
                      </td>
                      <td className="py-3 px-2 text-center text-gray-600">{day.appointments}</td>
                      <td className="py-3 px-2 text-center">
                        <span className="text-green-600">{day.completed}</span>
                      </td>
                      <td className="py-3 px-2 text-center">
                        <span className={day.noShows > 0 ? 'text-red-600' : 'text-gray-400'}>
                          {day.noShows}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-center">
                        <span className={day.avgWaitMin > 20 ? 'text-amber-600' : 'text-gray-600'}>
                          {day.avgWaitMin}m
                        </span>
                      </td>
                      <td className="py-3 px-2 text-center text-gray-600">{day.avgConsultMin}m</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Simple bar chart visualization */}
      {dashboard?.byDay && dashboard.byDay.length > 0 && (
        <div className="card mt-6">
          <h2 className="text-lg font-heading font-semibold text-gray-900 mb-4">
            Appointments Trend
          </h2>
          <div className="flex items-end gap-1 h-32">
            {dashboard.byDay.map((day) => {
              const maxAppts = Math.max(...dashboard.byDay.map(d => d.appointments), 1);
              const height = (day.appointments / maxAppts) * 100;
              return (
                <div
                  key={day.date}
                  className="flex-1 flex flex-col items-center gap-1"
                >
                  <div className="w-full flex flex-col items-center">
                    <span className="text-xs text-gray-500 mb-1">{day.appointments}</span>
                    <div
                      className="w-full bg-primary-500 rounded-t transition-all"
                      style={{ height: `${height}px`, minHeight: day.appointments > 0 ? '4px' : '0' }}
                    />
                  </div>
                  <span className="text-xs text-gray-400">{formatDateShort(day.date)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* User Info */}
      <div className="mt-8 p-4 bg-gray-50 rounded-lg">
        <div className="flex flex-wrap gap-4 text-sm text-gray-600">
          <div>
            <span className="text-gray-400">Logged in as:</span>{' '}
            <span className="font-medium">{user?.firstName || user?.email}</span>
          </div>
          <div>
            <span className="text-gray-400">Date range:</span>{' '}
            <span className="font-medium">{dateRange.from} to {dateRange.to}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Format time in clinic timezone
function formatTimeInTz(timeStr: string, timezone?: string): string {
  const tz = timezone || 'America/Chicago';
  if (timeStr.includes('T')) {
    return new Date(timeStr).toLocaleTimeString('en-US', {
      timeZone: tz,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

// Get greeting based on time
function getGreeting(timezone?: string): string {
  const tz = timezone || 'America/Chicago';
  const hour = parseInt(new Date().toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', hour12: false }));
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

// Doctor Dashboard Component - For non-manager doctors viewing their own data
function DoctorDashboard() {
  const { user, clinic, doctorId } = useAuth();

  // Get clinic time from server
  const { data: clinicTime, isLoading: clinicTimeLoading } = useClinicTime();
  const timezone = clinicTime?.timezone || clinic?.timezone;

  // Initialize date from clinic time
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [dateInitialized, setDateInitialized] = useState(false);
  const [currentTime, setCurrentTime] = useState<string>('');

  // Update current time every minute
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('en-US', {
        timeZone: timezone || 'America/Chicago',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }));
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, [timezone]);

  // Set initial date from clinic time once loaded
  useEffect(() => {
    if (clinicTime?.currentDate && !dateInitialized) {
      setSelectedDate(clinicTime.currentDate);
      setDateInitialized(true);
    }
  }, [clinicTime?.currentDate, dateInitialized]);

  // Fetch doctor dashboard data (auto-filtered to this doctor)
  const { data: dashboard, isLoading, error, refetch } = useDoctorDashboard(selectedDate, doctorId || undefined);

  // Mutations for queue management
  const callPatientMutation = useCallPatient(selectedDate, doctorId || undefined);
  const completeMutation = useCompleteConsultation(selectedDate, doctorId || undefined);
  const noShowMutation = useQueueNoShow(selectedDate, doctorId || undefined);

  const handleCallPatient = async (queueEntryId: string) => {
    try { await callPatientMutation.mutateAsync(queueEntryId); } catch (e) { console.error('Call failed:', e); }
  };

  const handleComplete = async (queueEntryId: string) => {
    try { await completeMutation.mutateAsync(queueEntryId); } catch (e) { console.error('Complete failed:', e); }
  };

  const handleNoShow = async (queueEntryId: string) => {
    try { await noShowMutation.mutateAsync(queueEntryId); } catch (e) { console.error('No-show failed:', e); }
  };

  // Show loading until clinic time is loaded
  if (clinicTimeLoading || !selectedDate) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  // If doctor not linked to a doctor record
  if (!doctorId) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Doctor Profile Not Linked</h2>
        <p className="text-sm text-gray-500">Your account is not linked to a doctor profile. Please contact your clinic manager.</p>
      </div>
    );
  }

  const isToday = selectedDate === clinicTime?.currentDate;

  return (
    <div className="space-y-3">
      {/* Compact Stats Row */}
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-sky-50 border border-sky-100 rounded-lg px-3 py-2">
          <div className="text-xl font-bold text-sky-700">{isLoading ? '-' : dashboard?.counts.queued ?? 0}</div>
          <div className="text-[10px] text-sky-500 uppercase">In Queue</div>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          <div className="text-xl font-bold text-amber-700">{isLoading ? '-' : dashboard?.counts.waiting ?? 0}</div>
          <div className="text-[10px] text-amber-500 uppercase">Waiting</div>
        </div>
        <div className="bg-teal-50 border border-teal-100 rounded-lg px-3 py-2">
          <div className="text-xl font-bold text-teal-700">{isLoading ? '-' : dashboard?.counts.withDoctor ?? 0}</div>
          <div className="text-[10px] text-teal-500 uppercase">With You</div>
        </div>
        <div className="bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
          <div className="text-xl font-bold text-emerald-700">{isLoading ? '-' : dashboard?.counts.done ?? 0}</div>
          <div className="text-[10px] text-emerald-500 uppercase">Done</div>
        </div>
      </div>

      {/* Filters Row */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="text-xs px-2 py-1.5 border border-gray-200 rounded focus:ring-1 focus:ring-blue-400 focus:border-blue-400 bg-white"
          />
          <button
            onClick={() => refetch()}
            disabled={isLoading}
            className="text-xs px-2 py-1.5 text-gray-500 hover:bg-gray-100 rounded flex items-center gap-1"
          >
            <svg className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
        <div className="text-xs text-gray-500">
          {isToday ? 'Today' : formatDateShort(selectedDate)}
        </div>
      </div>

      {error && <div className="text-xs text-red-600 bg-red-50 px-2 py-1.5 rounded border border-red-100">{error.message}</div>}

      {/* Current Patient Card */}
      {dashboard?.currentPatient && (
        <div className="bg-gradient-to-br from-teal-50 to-emerald-50 border border-teal-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 text-teal-700 mb-3">
            <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <span className="text-xs font-bold uppercase tracking-wider">Current Patient</span>
            <div className="ml-auto">
              <span className="animate-pulse inline-block w-2 h-2 rounded-full bg-teal-500"></span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-lg font-semibold text-gray-900">#{dashboard.currentPatient.queueNumber} {dashboard.currentPatient.patientName}</div>
              <div className="text-xs text-teal-600">{dashboard.currentPatient.elapsedMin} min in consultation</div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleComplete(dashboard.currentPatient!.queueEntryId)}
                disabled={completeMutation.isPending}
                className="text-xs px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium shadow-sm"
              >
                Done
              </button>
              <button
                onClick={() => handleNoShow(dashboard.currentPatient!.queueEntryId)}
                disabled={noShowMutation.isPending}
                className="text-xs px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg border border-red-200"
                title="No Show"
              >
                NS
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Queue List */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gradient-to-r from-sky-50 to-cyan-50">
          <span className="text-xs font-semibold text-sky-700 flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Your Queue ({(dashboard?.counts.queued ?? 0) + (dashboard?.counts.waiting ?? 0)})
          </span>
        </div>
        <div className="max-h-[300px] overflow-y-auto">
          {isLoading ? (
            <div className="text-xs text-gray-400 p-4 text-center">Loading...</div>
          ) : !dashboard?.queue || dashboard.queue.length === 0 ? (
            <div className="p-6 text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
              </div>
              <p className="text-sm text-gray-500">No patients waiting</p>
              <p className="text-xs text-gray-400 mt-1">Your queue is empty</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {dashboard.queue.map((entry, index) => (
                <div key={entry.queueEntryId} className={`flex items-center justify-between px-3 py-3 hover:bg-gray-50 transition-colors ${index === 0 && !dashboard.currentPatient ? 'bg-blue-50' : ''}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center text-xs font-bold text-white shadow-sm flex-shrink-0">
                      {entry.queueNumber}
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm text-gray-800 font-medium truncate">{entry.patientName}</div>
                      <div className="text-[10px] text-gray-400">
                        {entry.priority !== 'NORMAL' && (
                          <span className={`mr-2 px-1.5 py-0.5 rounded text-[8px] font-bold ${
                            entry.priority === 'EMERGENCY' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {entry.priority === 'EMERGENCY' ? 'URGENT' : 'HIGH'}
                          </span>
                        )}
                        {entry.waitMinutes > 0 && `Waiting ${entry.waitMinutes}m`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {entry.status === 'QUEUED' || entry.status === 'WAITING' ? (
                      <button
                        onClick={() => handleCallPatient(entry.queueEntryId)}
                        disabled={callPatientMutation.isPending || !!dashboard.currentPatient}
                        className={`text-xs px-3 py-1.5 rounded-lg font-medium shadow-sm ${
                          !dashboard.currentPatient
                            ? 'bg-blue-600 text-white hover:bg-blue-700'
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        Call
                      </button>
                    ) : (
                      <span className="text-xs px-2 py-1 rounded-full bg-teal-100 text-teal-700 font-medium">
                        With You
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-2">
        <Link
          href="/app/queue"
          className="flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-medium shadow-sm transition-all"
        >
          <svg className="w-4 h-4 text-sky-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <span className="text-sm">Full Queue</span>
        </Link>
        <Link
          href="/app/appointments"
          className="flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-medium shadow-sm transition-all"
        >
          <svg className="w-4 h-4 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-sm">Appointments</span>
        </Link>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-[10px] text-gray-400 pt-3 border-t border-gray-100">
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          Dr. {user?.firstName || user?.email}
        </span>
        <span>Last updated: {currentTime}</span>
      </div>
    </div>
  );
}

// Staff Dashboard Component - Enhanced Design
function StaffDashboard() {
  const { user, clinic, clinicRole } = useAuth();

  // Get clinic time from server (reliable source of truth)
  const { data: clinicTime, isLoading: clinicTimeLoading } = useClinicTime();
  const timezone = clinicTime?.timezone || clinic?.timezone;

  // Initialize date from clinic time (not browser time)
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [dateInitialized, setDateInitialized] = useState(false);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [currentTime, setCurrentTime] = useState<string>('');

  // Update current time every minute
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('en-US', {
        timeZone: timezone || 'America/Chicago',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }));
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, [timezone]);

  // Set initial date from clinic time once loaded
  useEffect(() => {
    if (clinicTime?.currentDate && !dateInitialized) {
      setSelectedDate(clinicTime.currentDate);
      setDateInitialized(true);
    }
  }, [clinicTime?.currentDate, dateInitialized]);

  // Fetch doctors for dropdown
  const { data: doctors } = useQuery({
    queryKey: ['doctors'],
    queryFn: async () => {
      const { data, error } = await listDoctors();
      if (error) throw new Error(error.message);
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch dashboard data
  const { data: dashboard, isLoading, error, refetch } = useStaffDashboard(selectedDate, selectedDoctorId || undefined);

  // Mutations
  const checkinMutation = useCheckinFromDashboard(selectedDate, selectedDoctorId || undefined);
  const noShowMutation = useNoShowFromDashboard(selectedDate, selectedDoctorId || undefined);

  const handleCheckin = async (appointmentId: string) => {
    try { await checkinMutation.mutateAsync(appointmentId); } catch (e) { console.error('Check-in failed:', e); }
  };

  const handleNoShow = async (appointmentId: string) => {
    try { await noShowMutation.mutateAsync(appointmentId); } catch (e) { console.error('No-show failed:', e); }
  };

  // Calculate next appointment
  const nextAppointment = useMemo(() => {
    if (!dashboard?.scheduledList) return null;
    const booked = dashboard.scheduledList.find(a => a.status === 'BOOKED');
    return booked || null;
  }, [dashboard?.scheduledList]);

  // Calculate progress percentage
  const progressPct = useMemo(() => {
    if (!dashboard?.counts) return 0;
    const total = dashboard.counts.scheduled + dashboard.counts.queued;
    if (total === 0) return 0;
    return Math.round((dashboard.counts.done / total) * 100);
  }, [dashboard?.counts]);

  // Show loading until clinic time is loaded
  if (clinicTimeLoading || !selectedDate) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  const isToday = selectedDate === clinicTime?.currentDate;

  return (
    <div className="space-y-3">
      {/* Compact Stats Row */}
      <div className="grid grid-cols-5 gap-2">
        <div className="bg-violet-50 border border-violet-100 rounded-lg px-3 py-2">
          <div className="text-xl font-bold text-violet-700">{isLoading ? '-' : dashboard?.counts.scheduled ?? 0}</div>
          <div className="text-[10px] text-violet-500 uppercase">Scheduled</div>
        </div>
        <div className="bg-sky-50 border border-sky-100 rounded-lg px-3 py-2">
          <div className="text-xl font-bold text-sky-700">{isLoading ? '-' : dashboard?.counts.queued ?? 0}</div>
          <div className="text-[10px] text-sky-500 uppercase">Queued</div>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          <div className="text-xl font-bold text-amber-700">{isLoading ? '-' : dashboard?.counts.waiting ?? 0}</div>
          <div className="text-[10px] text-amber-500 uppercase">Waiting</div>
        </div>
        <div className="bg-teal-50 border border-teal-100 rounded-lg px-3 py-2">
          <div className="text-xl font-bold text-teal-700">{isLoading ? '-' : dashboard?.counts.withDoctor ?? 0}</div>
          <div className="text-[10px] text-teal-500 uppercase">With Dr</div>
        </div>
        <div className="bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
          <div className="text-xl font-bold text-emerald-700">{isLoading ? '-' : dashboard?.counts.done ?? 0}</div>
          <div className="text-[10px] text-emerald-500 uppercase">Done</div>
        </div>
      </div>

      {/* Filters Row */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="text-xs px-2 py-1.5 border border-gray-200 rounded focus:ring-1 focus:ring-blue-400 focus:border-blue-400 bg-white"
          />
          <select
            value={selectedDoctorId}
            onChange={(e) => setSelectedDoctorId(e.target.value)}
            className="text-xs px-2 py-1.5 border border-gray-200 rounded focus:ring-1 focus:ring-blue-400 focus:border-blue-400 bg-white max-w-[140px]"
          >
            <option value="">All Doctors</option>
            {doctors?.map((doc: Doctor) => (
              <option key={doc.id} value={doc.id}>{doc.fullName}</option>
            ))}
          </select>
          <button
            onClick={() => refetch()}
            disabled={isLoading}
            className="text-xs px-2 py-1.5 text-gray-500 hover:bg-gray-100 rounded flex items-center gap-1"
          >
            <svg className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {error && <div className="text-xs text-red-600 bg-red-50 px-2 py-1.5 rounded border border-red-100">{error.message}</div>}

      {/* Alert Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Next Up Card */}
        {nextAppointment && isToday && (
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-3 shadow-sm">
            <div className="flex items-center gap-2 text-blue-700 mb-2">
              <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider">Next Appointment</span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-gray-900">{nextAppointment.patientName}</div>
                <div className="text-xs text-blue-600 font-medium">{formatTimeInTz(nextAppointment.time, timezone)}</div>
              </div>
              <button
                onClick={() => handleCheckin(nextAppointment.appointmentId)}
                disabled={checkinMutation.isPending}
                className="text-[10px] px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm"
              >
                Check In
              </button>
            </div>
          </div>
        )}

        {/* With Doctor Card */}
        {dashboard?.withDoctor && (
          <div className="bg-gradient-to-br from-teal-50 to-emerald-50 border border-teal-200 rounded-xl p-3 shadow-sm">
            <div className="flex items-center gap-2 text-teal-700 mb-2">
              <div className="w-6 h-6 rounded-full bg-teal-100 flex items-center justify-center">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider">With Doctor</span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-gray-900">#{dashboard.withDoctor.queueNumber} {dashboard.withDoctor.patientName}</div>
                <div className="text-xs text-teal-600">{dashboard.withDoctor.elapsedMin} min in consultation</div>
              </div>
              <div className="w-8 h-8 rounded-full bg-teal-500 flex items-center justify-center">
                <span className="animate-pulse w-2 h-2 rounded-full bg-white"></span>
              </div>
            </div>
          </div>
        )}

        {/* Long Wait Alert */}
        {dashboard?.waitingLong && dashboard.waitingLong.length > 0 && (
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-3 shadow-sm">
            <div className="flex items-center gap-2 text-amber-700 mb-2">
              <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider">Long Wait ({dashboard.waitingLong.length})</span>
            </div>
            <div className="space-y-1">
              {dashboard.waitingLong.slice(0, 2).map((item) => (
                <div key={item.queueEntryId} className="flex items-center justify-between text-xs">
                  <span className="text-gray-700 truncate">#{item.queueNumber} {item.patientName}</span>
                  <span className="text-amber-600 font-medium flex-shrink-0">{item.minutesWaiting}m</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-2 gap-3">
        {/* Scheduled Appointments */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gradient-to-r from-violet-50 to-purple-50">
            <span className="text-xs font-semibold text-violet-700 flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Scheduled ({dashboard?.counts.scheduled ?? 0})
            </span>
            <Link href="/app/appointments" className="text-[10px] text-violet-600 hover:text-violet-800 font-medium">View all →</Link>
          </div>
          <div className="max-h-[220px] overflow-y-auto">
            {isLoading ? (
              <div className="text-xs text-gray-400 p-4 text-center">Loading...</div>
            ) : !dashboard?.scheduledList || dashboard.scheduledList.length === 0 ? (
              <div className="p-6 text-center">
                <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-gray-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-xs text-gray-500">No appointments scheduled</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {dashboard.scheduledList.slice(0, 10).map((appt) => (
                  <div key={appt.appointmentId} className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="text-[10px] font-medium text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded w-16 text-center flex-shrink-0">
                        {formatTimeInTz(appt.time, timezone)}
                      </div>
                      <span className="text-[11px] text-gray-800 truncate font-medium">{appt.patientName}</span>
                    </div>
                    {appt.status === 'BOOKED' ? (
                      <div className="flex gap-1 flex-shrink-0">
                        <button
                          onClick={() => handleCheckin(appt.appointmentId)}
                          disabled={checkinMutation.isPending}
                          className="text-[9px] px-2 py-1 bg-emerald-500 text-white rounded-md hover:bg-emerald-600 font-medium shadow-sm"
                        >
                          Check In
                        </button>
                        <button
                          onClick={() => handleNoShow(appt.appointmentId)}
                          disabled={noShowMutation.isPending}
                          className="text-[9px] px-1.5 py-1 text-red-500 hover:bg-red-50 rounded-md"
                          title="No Show"
                        >
                          NS
                        </button>
                      </div>
                    ) : (
                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-medium ${
                        appt.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                        appt.status === 'NO_SHOW' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {appt.status === 'COMPLETED' ? 'Done' : appt.status === 'NO_SHOW' ? 'No Show' : appt.status}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Queue Overview */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gradient-to-r from-sky-50 to-cyan-50">
            <span className="text-xs font-semibold text-sky-700 flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Queue ({(dashboard?.counts.queued ?? 0) + (dashboard?.counts.waiting ?? 0)})
            </span>
            <Link href="/app/queue" className="text-[10px] text-sky-600 hover:text-sky-800 font-medium">View queue →</Link>
          </div>
          <div className="max-h-[220px] overflow-y-auto">
            {isLoading ? (
              <div className="text-xs text-gray-400 p-4 text-center">Loading...</div>
            ) : !dashboard?.queuedList || dashboard.queuedList.length === 0 ? (
              <div className="p-6 text-center">
                <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-gray-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                </div>
                <p className="text-xs text-gray-500">No patients in queue</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {dashboard.queuedList.slice(0, 10).map((entry) => (
                  <div key={entry.queueEntryId} className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-7 h-7 rounded-full bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center text-[10px] font-bold text-white shadow-sm flex-shrink-0">
                        {entry.queueNumber}
                      </span>
                      <span className="text-[11px] text-gray-800 truncate font-medium">{entry.patientName}</span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {entry.priority !== 'NORMAL' && (
                        <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold ${
                          entry.priority === 'EMERGENCY' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {entry.priority === 'EMERGENCY' ? 'URGENT' : 'HIGH'}
                        </span>
                      )}
                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-medium ${
                        entry.status === 'WAITING' ? 'bg-amber-100 text-amber-700' :
                        entry.status === 'WITH_DOCTOR' ? 'bg-teal-100 text-teal-700' : 'bg-sky-100 text-sky-700'
                      }`}>
                        {entry.status === 'WAITING' ? 'Waiting' : entry.status === 'WITH_DOCTOR' ? 'With Dr' : 'Queued'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-2">
        <Link
          href="/app/queue?action=walkin"
          className="flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 font-medium shadow-md transition-all hover:shadow-lg"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
          <span className="text-sm">New Walk-in</span>
        </Link>
        <Link
          href="/app/appointments"
          className="flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-medium shadow-sm transition-all"
        >
          <svg className="w-4 h-4 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-sm">Appointments</span>
        </Link>
        <Link
          href="/app/queue"
          className="flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-medium shadow-sm transition-all"
        >
          <svg className="w-4 h-4 text-sky-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <span className="text-sm">Queue Board</span>
        </Link>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-[10px] text-gray-400 pt-3 border-t border-gray-100">
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          {user?.firstName || user?.email} • {clinicRole?.replace('CLINIC_', '')}
        </span>
        <span>Last updated: {currentTime}</span>
      </div>
    </div>
  );
}
