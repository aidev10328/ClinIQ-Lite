'use client';

import { useState, useEffect } from 'react';
import { useOverviewReport, useNoShowsReport, useWaitTimesReport } from '../../../lib/hooks/useReports';
import { useFilteredDoctors } from '../../../lib/hooks/useDoctors';

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function getDefaultDateRange(days: number = 6) {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days);
  return { from: formatDate(from), to: formatDate(to) };
}

function formatDisplayDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function formatHour(hour: number): string {
  if (hour === 0) return '12 AM';
  if (hour === 12) return '12 PM';
  if (hour < 12) return `${hour} AM`;
  return `${hour - 12} PM`;
}

type TabType = 'overview' | 'no-shows' | 'wait-times';

// Icons
function ChartBarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function XCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ArrowTrendingUpIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const defaultRange = getDefaultDateRange();
  const [from, setFrom] = useState(defaultRange.from);
  const [to, setTo] = useState(defaultRange.to);
  const [doctorId, setDoctorId] = useState<string>('');

  const { data: doctors, currentDoctorId, canViewAllDoctors } = useFilteredDoctors();

  // Auto-select doctor for doctor-only users (not managers)
  useEffect(() => {
    if (currentDoctorId && !doctorId) {
      setDoctorId(currentDoctorId);
    }
  }, [currentDoctorId, doctorId]);

  const tabs = [
    { key: 'overview', label: 'Overview', icon: ChartBarIcon },
    { key: 'no-shows', label: 'No-Shows', icon: XCircleIcon },
    { key: 'wait-times', label: 'Wait Times', icon: ClockIcon },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-sm text-gray-500 mt-1">Performance metrics and insights</p>
        </div>
      </div>

      {/* Filters Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">From</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="px-3 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">To</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="px-3 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Doctor</label>
            <select
              value={doctorId}
              onChange={(e) => setDoctorId(e.target.value)}
              className="px-3 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm min-w-[180px] bg-white"
            >
              {canViewAllDoctors && <option value="">All Doctors</option>}
              {doctors?.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.fullName}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="border-b border-gray-200 bg-gray-50">
          <nav className="flex">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as TabType)}
                  className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 -mb-px transition-all ${
                    activeTab === tab.key
                      ? 'border-primary-600 text-primary-600 bg-white'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-5">
          {activeTab === 'overview' && (
            <OverviewTab from={from} to={to} doctorId={doctorId} />
          )}
          {activeTab === 'no-shows' && (
            <NoShowsTab from={from} to={to} doctorId={doctorId} />
          )}
          {activeTab === 'wait-times' && (
            <WaitTimesTab from={from} to={to} doctorId={doctorId} />
          )}
        </div>
      </div>
    </div>
  );
}

// Overview Tab
function OverviewTab({ from, to, doctorId }: { from: string; to: string; doctorId: string }) {
  const { data, isLoading, error } = useOverviewReport(from, to, doctorId || undefined);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 flex items-center gap-3">
        <XCircleIcon className="w-5 h-5" />
        Failed to load report: {error.message}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KpiCard
          label="Total Patients"
          value={data.kpis.totalAppointments}
          icon={UsersIcon}
          color="primary"
        />
        <KpiCard
          label="Completed"
          value={data.kpis.completedAppointments}
          icon={CheckCircleIcon}
          color="green"
          subValue={data.kpis.totalAppointments > 0
            ? `${Math.round((data.kpis.completedAppointments / data.kpis.totalAppointments) * 100)}%`
            : undefined}
        />
        <KpiCard
          label="No-Show Rate"
          value={`${data.kpis.noShowRate}%`}
          icon={XCircleIcon}
          color={data.kpis.noShowRate > 20 ? 'red' : 'orange'}
          highlight={data.kpis.noShowRate > 20}
        />
        <KpiCard
          label="Avg Wait"
          value={`${data.kpis.avgWaitMin} min`}
          icon={ClockIcon}
          color={data.kpis.avgWaitMin > 30 ? 'red' : 'blue'}
          highlight={data.kpis.avgWaitMin > 30}
        />
        <KpiCard
          label="Walk-in %"
          value={`${data.kpis.walkinPct}%`}
          icon={ArrowTrendingUpIcon}
          color="purple"
        />
      </div>

      {/* By Day Table */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100">
          <div className="flex items-center gap-2">
            <ChartBarIcon className="w-5 h-5 text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-900">Daily Breakdown</h2>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Patients</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Completed</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">No-Shows</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Walk-ins</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Avg Wait</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-32">Completion</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {data.byDay.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <div className="text-gray-400">
                      <ChartBarIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p className="text-sm font-medium">No data for selected period</p>
                      <p className="text-xs text-gray-400 mt-1">Try adjusting your date range</p>
                    </div>
                  </td>
                </tr>
              ) : (
                data.byDay.map((day, idx) => {
                  const completionRate = day.appointments > 0
                    ? Math.round((day.completed / day.appointments) * 100)
                    : 0;
                  return (
                    <tr key={day.date} className={`hover:bg-gray-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                        {formatDisplayDate(day.date)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right font-semibold">{day.appointments}</td>
                      <td className="px-4 py-3 text-sm text-right">
                        <span className="text-green-700 font-medium">{day.completed}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        <span className={`font-medium ${day.noShows > 0 ? 'text-orange-600' : 'text-gray-500'}`}>
                          {day.noShows}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 text-right">{day.walkins}</td>
                      <td className="px-4 py-3 text-sm text-right">
                        <span className={`font-medium ${day.avgWaitMin > 30 ? 'text-red-600' : 'text-gray-900'}`}>
                          {day.avgWaitMin} min
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-2 rounded-full transition-all ${
                                completionRate >= 80 ? 'bg-green-500' : completionRate >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${completionRate}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium text-gray-600 w-10 text-right">{completionRate}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* By Doctor Table */}
      {!doctorId && (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100">
            <div className="flex items-center gap-2">
              <UsersIcon className="w-5 h-5 text-gray-500" />
              <h2 className="text-sm font-semibold text-gray-900">By Doctor</h2>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Doctor</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Patients</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Completed</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">No-Shows</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Avg Wait</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-36">Utilization</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {data.byDoctor.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center">
                      <div className="text-gray-400">
                        <UsersIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p className="text-sm font-medium">No data for selected period</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  data.byDoctor.map((doc, idx) => (
                    <tr key={doc.doctorId} className={`hover:bg-gray-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{doc.doctorName}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right font-semibold">{doc.appointments}</td>
                      <td className="px-4 py-3 text-sm text-right">
                        <span className="text-green-700 font-medium">{doc.completed}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        <span className={`font-medium ${doc.noShows > 0 ? 'text-orange-600' : 'text-gray-500'}`}>
                          {doc.noShows}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        <span className={`font-medium ${doc.avgWaitMin > 30 ? 'text-red-600' : 'text-gray-900'}`}>
                          {doc.avgWaitMin} min
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {doc.utilizationPct !== null ? (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                              <div
                                className={`h-2 rounded-full transition-all ${
                                  doc.utilizationPct >= 80 ? 'bg-green-500' : doc.utilizationPct >= 60 ? 'bg-blue-500' : 'bg-yellow-500'
                                }`}
                                style={{ width: `${doc.utilizationPct}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium text-gray-600 w-10 text-right">{doc.utilizationPct}%</span>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// No-Shows Tab
function NoShowsTab({ from, to, doctorId }: { from: string; to: string; doctorId: string }) {
  const { data, isLoading, error } = useNoShowsReport(from, to, doctorId || undefined);

  const totalPatients = data?.byDow.reduce((sum, d) => sum + d.total, 0) || 0;
  const totalNoShows = data?.byDow.reduce((sum, d) => sum + d.noShows, 0) || 0;
  const overallRate = totalPatients > 0 ? Math.round((totalNoShows / totalPatients) * 100) : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 flex items-center gap-3">
        <XCircleIcon className="w-5 h-5" />
        Failed to load report: {error.message}
      </div>
    );
  }

  if (!data) return null;

  // Find worst day and hour
  const worstDay = data.byDow.reduce((prev, curr) => (curr.noShowRate > prev.noShowRate ? curr : prev), data.byDow[0]);
  const worstHour = data.byHour.length > 0
    ? data.byHour.reduce((prev, curr) => (curr.noShowRate > prev.noShowRate ? curr : prev), data.byHour[0])
    : null;

  return (
    <div className="space-y-6">
      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Total Patients"
          value={totalPatients}
          icon={UsersIcon}
          color="primary"
        />
        <KpiCard
          label="No-Shows"
          value={totalNoShows}
          icon={XCircleIcon}
          color="orange"
        />
        <KpiCard
          label="No-Show Rate"
          value={`${overallRate}%`}
          icon={ChartBarIcon}
          color={overallRate > 20 ? 'red' : 'green'}
          highlight={overallRate > 20}
        />
        {worstDay && (
          <KpiCard
            label="Worst Day"
            value={DAY_NAMES[worstDay.dow]}
            subValue={`${worstDay.noShowRate}% rate`}
            icon={XCircleIcon}
            color="red"
          />
        )}
      </div>

      {/* By Day of Week Table */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100">
          <div className="flex items-center gap-2">
            <ChartBarIcon className="w-5 h-5 text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-900">No-Shows by Day of Week</h2>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Day</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Total</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">No-Shows</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Rate</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-48"></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {data.byDow.map((row, idx) => (
                <tr key={row.dow} className={`hover:bg-gray-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{DAY_NAMES[row.dow]}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right font-semibold">{row.total}</td>
                  <td className="px-4 py-3 text-sm text-right">
                    <span className={`font-medium ${row.noShows > 0 ? 'text-orange-600' : 'text-gray-500'}`}>
                      {row.noShows}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-right">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                      row.noShowRate > 20 ? 'bg-red-100 text-red-800' : row.noShowRate > 10 ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'
                    }`}>
                      {row.noShowRate}%
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                      <div
                        className={`h-2.5 rounded-full transition-all ${
                          row.noShowRate > 20 ? 'bg-red-500' : row.noShowRate > 10 ? 'bg-orange-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(row.noShowRate * 2, 100)}%` }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* By Hour Table */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100">
          <div className="flex items-center gap-2">
            <ClockIcon className="w-5 h-5 text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-900">No-Shows by Hour of Day</h2>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Hour</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Total</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">No-Shows</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Rate</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-48"></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {data.byHour.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <div className="text-gray-400">
                      <ClockIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p className="text-sm font-medium">No data for selected period</p>
                    </div>
                  </td>
                </tr>
              ) : (
                data.byHour.map((row, idx) => (
                  <tr key={row.hour} className={`hover:bg-gray-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{formatHour(row.hour)}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right font-semibold">{row.total}</td>
                    <td className="px-4 py-3 text-sm text-right">
                      <span className={`font-medium ${row.noShows > 0 ? 'text-orange-600' : 'text-gray-500'}`}>
                        {row.noShows}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                        row.noShowRate > 20 ? 'bg-red-100 text-red-800' : row.noShowRate > 10 ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {row.noShowRate}%
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                        <div
                          className={`h-2.5 rounded-full transition-all ${
                            row.noShowRate > 20 ? 'bg-red-500' : row.noShowRate > 10 ? 'bg-orange-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${Math.min(row.noShowRate * 2, 100)}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Wait Times Tab
function WaitTimesTab({ from, to, doctorId }: { from: string; to: string; doctorId: string }) {
  const { data, isLoading, error } = useWaitTimesReport(from, to, doctorId || undefined);

  const maxCount = data ? Math.max(...data.distribution.map((d) => d.count), 1) : 1;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 flex items-center gap-3">
        <XCircleIcon className="w-5 h-5" />
        Failed to load report: {error.message}
      </div>
    );
  }

  if (!data) return null;

  // Calculate wait time stats
  const goodWaitCount = data.distribution
    .filter(d => d.bucket === '0-15' || d.bucket === '16-30')
    .reduce((sum, d) => sum + d.count, 0);
  const totalCount = data.distribution.reduce((sum, d) => sum + d.count, 0);
  const goodWaitPct = totalCount > 0 ? Math.round((goodWaitCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Avg Wait Time"
          value={`${data.avgWaitMin} min`}
          icon={ClockIcon}
          color={data.avgWaitMin > 30 ? 'red' : data.avgWaitMin > 20 ? 'orange' : 'green'}
          highlight={data.avgWaitMin > 30}
        />
        <KpiCard
          label="Avg Consultation"
          value={`${data.avgConsultMin} min`}
          icon={UsersIcon}
          color="blue"
        />
        <KpiCard
          label="Under 30 min"
          value={`${goodWaitPct}%`}
          subValue={`${goodWaitCount} patients`}
          icon={CheckCircleIcon}
          color="green"
        />
        <KpiCard
          label="Total Patients"
          value={totalCount}
          icon={UsersIcon}
          color="primary"
        />
      </div>

      {/* Wait Time Distribution */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100">
          <div className="flex items-center gap-2">
            <ChartBarIcon className="w-5 h-5 text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-900">Wait Time Distribution</h2>
          </div>
        </div>
        <div className="p-5">
          <div className="space-y-4">
            {data.distribution.map((bucket) => {
              const isHighWait = bucket.bucket === '60+' || bucket.bucket === '46-60' || bucket.bucket === '31-45';
              const pct = totalCount > 0 ? Math.round((bucket.count / totalCount) * 100) : 0;
              return (
                <div key={bucket.bucket} className="flex items-center gap-4">
                  <div className="w-20 text-sm font-medium text-gray-700 text-right">{bucket.bucket} min</div>
                  <div className="flex-1">
                    <div className="w-full bg-gray-100 rounded-lg h-8 relative overflow-hidden">
                      <div
                        className={`h-8 rounded-lg transition-all ${
                          isHighWait
                            ? 'bg-gradient-to-r from-orange-400 to-orange-500'
                            : 'bg-gradient-to-r from-primary-400 to-primary-500'
                        }`}
                        style={{ width: `${(bucket.count / maxCount) * 100}%` }}
                      />
                      {bucket.count > 0 && (
                        <span className={`absolute inset-y-0 flex items-center text-sm font-semibold ${
                          (bucket.count / maxCount) > 0.15 ? 'left-3 text-white' : 'left-[calc(100%+8px)] text-gray-700'
                        }`} style={(bucket.count / maxCount) <= 0.15 ? { left: `calc(${(bucket.count / maxCount) * 100}% + 8px)` } : {}}>
                          {bucket.count} ({pct}%)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-200 flex items-center gap-6 text-xs text-gray-500">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-primary-500"></div>
              <span>Good (under 30 min)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-orange-500"></div>
              <span>High (over 30 min)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Daily Trend Table */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100">
          <div className="flex items-center gap-2">
            <ArrowTrendingUpIcon className="w-5 h-5 text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-900">Daily Trends</h2>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Avg Wait</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Avg Consult</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-64">Wait Time</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {data.byDay.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center">
                    <div className="text-gray-400">
                      <ClockIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p className="text-sm font-medium">No data for selected period</p>
                    </div>
                  </td>
                </tr>
              ) : (
                data.byDay.map((day, idx) => (
                  <tr key={day.date} className={`hover:bg-gray-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                      {formatDisplayDate(day.date)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                        day.avgWaitMin > 30 ? 'bg-red-100 text-red-800' : day.avgWaitMin > 20 ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {day.avgWaitMin} min
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">{day.avgConsultMin} min</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2.5 overflow-hidden">
                          <div
                            className={`h-2.5 rounded-full transition-all ${
                              day.avgWaitMin > 30 ? 'bg-red-500' : day.avgWaitMin > 20 ? 'bg-orange-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${Math.min((day.avgWaitMin / 60) * 100, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 w-8">{Math.min(Math.round((day.avgWaitMin / 60) * 100), 100)}%</span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  subValue,
  icon: Icon,
  color = 'primary',
  highlight,
}: {
  label: string;
  value: string | number;
  subValue?: string;
  icon?: React.FC<{ className?: string }>;
  color?: 'primary' | 'green' | 'blue' | 'orange' | 'red' | 'purple';
  highlight?: boolean;
}) {
  const colorClasses = {
    primary: {
      bg: 'bg-gradient-to-br from-primary-50 to-primary-100',
      border: 'border-primary-200',
      icon: 'bg-primary-100 text-primary-600',
      text: 'text-primary-700',
    },
    green: {
      bg: 'bg-gradient-to-br from-green-50 to-green-100',
      border: 'border-green-200',
      icon: 'bg-green-100 text-green-600',
      text: 'text-green-700',
    },
    blue: {
      bg: 'bg-gradient-to-br from-blue-50 to-blue-100',
      border: 'border-blue-200',
      icon: 'bg-blue-100 text-blue-600',
      text: 'text-blue-700',
    },
    orange: {
      bg: 'bg-gradient-to-br from-orange-50 to-orange-100',
      border: 'border-orange-200',
      icon: 'bg-orange-100 text-orange-600',
      text: 'text-orange-700',
    },
    red: {
      bg: 'bg-gradient-to-br from-red-50 to-red-100',
      border: 'border-red-200',
      icon: 'bg-red-100 text-red-600',
      text: 'text-red-700',
    },
    purple: {
      bg: 'bg-gradient-to-br from-purple-50 to-purple-100',
      border: 'border-purple-200',
      icon: 'bg-purple-100 text-purple-600',
      text: 'text-purple-700',
    },
  };

  const colors = colorClasses[highlight ? 'red' : color];

  return (
    <div className={`rounded-xl border p-4 ${colors.bg} ${colors.border}`}>
      <div className="flex items-start gap-3">
        {Icon && (
          <div className={`p-2 rounded-lg ${colors.icon}`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-semibold uppercase tracking-wide ${colors.text} opacity-80`}>{label}</p>
          <p className={`text-2xl font-bold mt-0.5 ${highlight ? 'text-red-600' : 'text-gray-900'}`}>{value}</p>
          {subValue && <p className={`text-xs mt-0.5 ${colors.text} opacity-70`}>{subValue}</p>}
        </div>
      </div>
    </div>
  );
}
