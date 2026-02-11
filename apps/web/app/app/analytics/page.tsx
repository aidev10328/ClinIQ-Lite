'use client';

import { useState } from 'react';
import { useOverviewReport, useNoShowsReport, useWaitTimesReport } from '../../../lib/hooks/useReports';
import { useDoctors } from '../../../lib/hooks/useDoctors';

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function getDefaultDateRange(days: number = 6) {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days);
  return { from: formatDate(from), to: formatDate(to) };
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function formatHour(hour: number): string {
  if (hour === 0) return '12 AM';
  if (hour === 12) return '12 PM';
  if (hour < 12) return `${hour} AM`;
  return `${hour - 12} PM`;
}

type TabType = 'overview' | 'no-shows' | 'wait-times';

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const defaultRange = getDefaultDateRange();
  const [from, setFrom] = useState(defaultRange.from);
  const [to, setTo] = useState(defaultRange.to);
  const [doctorId, setDoctorId] = useState<string>('');

  const { data: doctors } = useDoctors();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Analytics</h1>
        <p className="text-sm text-gray-500 mt-1">Performance metrics and insights</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Doctor</label>
          <select
            value={doctorId}
            onChange={(e) => setDoctorId(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-sm min-w-[160px]"
          >
            <option value="">All Doctors</option>
            {doctors?.map((doc) => (
              <option key={doc.id} value={doc.id}>
                {doc.fullName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          {[
            { key: 'overview', label: 'Overview' },
            { key: 'no-shows', label: 'No-Shows' },
            { key: 'wait-times', label: 'Wait Times' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as TabType)}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
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
  );
}

// Overview Tab
function OverviewTab({ from, to, doctorId }: { from: string; to: string; doctorId: string }) {
  const { data, isLoading, error } = useOverviewReport(from, to, doctorId || undefined);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        Failed to load report: {error.message}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KpiCard label="Total Patients" value={data.kpis.totalAppointments} />
        <KpiCard label="Completed" value={data.kpis.completedAppointments} />
        <KpiCard label="No-Show Rate" value={`${data.kpis.noShowRate}%`} highlight={data.kpis.noShowRate > 20} />
        <KpiCard label="Avg Wait" value={`${data.kpis.avgWaitMin} min`} highlight={data.kpis.avgWaitMin > 30} />
        <KpiCard label="Walk-in %" value={`${data.kpis.walkinPct}%`} />
      </div>

      {/* By Day Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-900">By Day</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Patients</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Completed</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">No-Shows</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Walk-ins</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Avg Wait</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.byDay.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-4 text-center text-sm text-gray-500">
                    No data for selected period
                  </td>
                </tr>
              ) : (
                data.byDay.map((day) => (
                  <tr key={day.date} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm text-gray-900">{day.date}</td>
                    <td className="px-4 py-2 text-sm text-gray-900 text-right">{day.appointments}</td>
                    <td className="px-4 py-2 text-sm text-gray-900 text-right">{day.completed}</td>
                    <td className="px-4 py-2 text-sm text-gray-900 text-right">{day.noShows}</td>
                    <td className="px-4 py-2 text-sm text-gray-900 text-right">{day.walkins}</td>
                    <td className="px-4 py-2 text-sm text-gray-900 text-right">{day.avgWaitMin} min</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* By Doctor Table */}
      {!doctorId && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <h2 className="text-sm font-semibold text-gray-900">By Doctor</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Doctor</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Patients</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Completed</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">No-Shows</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Avg Wait</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Utilization</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.byDoctor.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-4 text-center text-sm text-gray-500">
                      No data for selected period
                    </td>
                  </tr>
                ) : (
                  data.byDoctor.map((doc) => (
                    <tr key={doc.doctorId} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm text-gray-900">{doc.doctorName}</td>
                      <td className="px-4 py-2 text-sm text-gray-900 text-right">{doc.appointments}</td>
                      <td className="px-4 py-2 text-sm text-gray-900 text-right">{doc.completed}</td>
                      <td className="px-4 py-2 text-sm text-gray-900 text-right">{doc.noShows}</td>
                      <td className="px-4 py-2 text-sm text-gray-900 text-right">{doc.avgWaitMin} min</td>
                      <td className="px-4 py-2 text-sm text-gray-900 text-right">
                        {doc.utilizationPct !== null ? `${doc.utilizationPct}%` : '-'}
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
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        Failed to load report: {error.message}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Summary KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <KpiCard label="Total Patients" value={totalPatients} />
        <KpiCard label="No-Shows" value={totalNoShows} />
        <KpiCard label="No-Show Rate" value={`${overallRate}%`} highlight={overallRate > 20} />
      </div>

      {/* By Day of Week Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-900">By Day of Week</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Day</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">No-Shows</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Rate</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase w-48"></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.byDow.map((row) => (
                <tr key={row.dow} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-sm text-gray-900">{DAY_NAMES[row.dow]}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 text-right">{row.total}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 text-right">{row.noShows}</td>
                  <td className="px-4 py-2 text-sm text-right">
                    <span className={row.noShowRate > 20 ? 'text-red-600 font-medium' : 'text-gray-900'}>
                      {row.noShowRate}%
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${row.noShowRate > 20 ? 'bg-red-500' : 'bg-primary-500'}`}
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
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-900">By Hour of Day</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Hour</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">No-Shows</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Rate</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase w-48"></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.byHour.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-4 text-center text-sm text-gray-500">
                    No data for selected period
                  </td>
                </tr>
              ) : (
                data.byHour.map((row) => (
                  <tr key={row.hour} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm text-gray-900">{formatHour(row.hour)}</td>
                    <td className="px-4 py-2 text-sm text-gray-900 text-right">{row.total}</td>
                    <td className="px-4 py-2 text-sm text-gray-900 text-right">{row.noShows}</td>
                    <td className="px-4 py-2 text-sm text-right">
                      <span className={row.noShowRate > 20 ? 'text-red-600 font-medium' : 'text-gray-900'}>
                        {row.noShowRate}%
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${row.noShowRate > 20 ? 'bg-red-500' : 'bg-primary-500'}`}
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
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        Failed to load report: {error.message}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Average Wait Time</p>
          <p className={`text-3xl font-semibold mt-1 ${data.avgWaitMin > 30 ? 'text-red-600' : 'text-gray-900'}`}>
            {data.avgWaitMin} <span className="text-lg font-normal text-gray-500">min</span>
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Average Consultation</p>
          <p className="text-3xl font-semibold text-gray-900 mt-1">
            {data.avgConsultMin} <span className="text-lg font-normal text-gray-500">min</span>
          </p>
        </div>
      </div>

      {/* Wait Time Distribution */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-900">Wait Time Distribution</h2>
        </div>
        <div className="p-4">
          <div className="space-y-3">
            {data.distribution.map((bucket) => (
              <div key={bucket.bucket} className="flex items-center gap-3">
                <div className="w-16 text-sm text-gray-600 text-right">{bucket.bucket} min</div>
                <div className="flex-1">
                  <div className="w-full bg-gray-100 rounded h-6 relative">
                    <div
                      className={`h-6 rounded ${
                        bucket.bucket === '60+' || bucket.bucket === '46-60' || bucket.bucket === '31-45'
                          ? 'bg-orange-400'
                          : 'bg-primary-500'
                      }`}
                      style={{ width: `${(bucket.count / maxCount) * 100}%` }}
                    />
                    {bucket.count > 0 && (
                      <span className="absolute inset-y-0 left-2 flex items-center text-sm font-medium text-white">
                        {bucket.count}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Daily Trend Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-900">Daily Trends</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Avg Wait</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Avg Consult</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase w-64">Wait Time</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.byDay.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-4 text-center text-sm text-gray-500">
                    No data for selected period
                  </td>
                </tr>
              ) : (
                data.byDay.map((day) => (
                  <tr key={day.date} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm text-gray-900">{day.date}</td>
                    <td className="px-4 py-2 text-sm text-right">
                      <span className={day.avgWaitMin > 30 ? 'text-red-600 font-medium' : 'text-gray-900'}>
                        {day.avgWaitMin} min
                      </span>
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-900 text-right">{day.avgConsultMin} min</td>
                    <td className="px-4 py-2">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${day.avgWaitMin > 30 ? 'bg-red-500' : 'bg-primary-500'}`}
                          style={{ width: `${Math.min((day.avgWaitMin / 60) * 100, 100)}%` }}
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

function KpiCard({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-semibold mt-1 ${highlight ? 'text-red-600' : 'text-gray-900'}`}>{value}</p>
    </div>
  );
}
