'use client';

import { useState } from 'react';
import { useNoShowsReport } from '../../../../lib/hooks/useReports';
import { useDoctors } from '../../../../lib/hooks/useDoctors';

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function getDefaultDateRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 29); // Last 30 days
  return { from: formatDate(from), to: formatDate(to) };
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function formatHour(hour: number): string {
  if (hour === 0) return '12 AM';
  if (hour === 12) return '12 PM';
  if (hour < 12) return `${hour} AM`;
  return `${hour - 12} PM`;
}

export default function NoShowsReportPage() {
  const defaultRange = getDefaultDateRange();
  const [from, setFrom] = useState(defaultRange.from);
  const [to, setTo] = useState(defaultRange.to);
  const [doctorId, setDoctorId] = useState<string>('');

  const { data, isLoading, error } = useNoShowsReport(from, to, doctorId || undefined);
  const { data: doctors } = useDoctors();

  // Calculate overall stats
  const totalPatients = data?.byDow.reduce((sum, d) => sum + d.total, 0) || 0;
  const totalNoShows = data?.byDow.reduce((sum, d) => sum + d.noShows, 0) || 0;
  const overallRate = totalPatients > 0 ? Math.round((totalNoShows / totalPatients) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">No-Show Analysis</h1>
        <p className="text-sm text-gray-500 mt-1">Identify no-show patterns by day of week and time of day</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Doctor</label>
          <select
            value={doctorId}
            onChange={(e) => setDoctorId(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm min-w-[160px]"
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

      {/* Loading / Error states */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          Failed to load report: {error.message}
        </div>
      )}

      {data && (
        <>
          {/* Summary KPIs */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Patients</p>
              <p className="text-2xl font-semibold text-gray-900 mt-1">{totalPatients}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">No-Shows</p>
              <p className="text-2xl font-semibold text-gray-900 mt-1">{totalNoShows}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">No-Show Rate</p>
              <p className={`text-2xl font-semibold mt-1 ${overallRate > 20 ? 'text-red-600' : 'text-gray-900'}`}>
                {overallRate}%
              </p>
            </div>
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
                            className={`h-2 rounded-full ${row.noShowRate > 20 ? 'bg-red-500' : 'bg-blue-500'}`}
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
                              className={`h-2 rounded-full ${row.noShowRate > 20 ? 'bg-red-500' : 'bg-blue-500'}`}
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
        </>
      )}
    </div>
  );
}
