'use client';

import { useState, useMemo } from 'react';
import { useAuth } from '../../../components/AuthProvider';
import StatCard from '../../../components/StatCard';
import { useManagerDashboard } from '../../../lib/hooks/useDashboardData';
import { listDoctors, Doctor } from '../../../lib/api';
import { useQuery } from '@tanstack/react-query';

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
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

export default function ManagerDashboardPage() {
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

  if (!isManager) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">You don't have access to the Manager Dashboard.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="page-title text-xl sm:text-2xl">Manager Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            {clinic?.name} • Analytics & Performance
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
