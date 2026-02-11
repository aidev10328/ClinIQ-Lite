'use client';

import { useState } from 'react';
import { useWaitTimesReport } from '../../../../lib/hooks/useReports';
import { useDoctors } from '../../../../lib/hooks/useDoctors';

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function getDefaultDateRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 6);
  return { from: formatDate(from), to: formatDate(to) };
}

export default function WaitTimesReportPage() {
  const defaultRange = getDefaultDateRange();
  const [from, setFrom] = useState(defaultRange.from);
  const [to, setTo] = useState(defaultRange.to);
  const [doctorId, setDoctorId] = useState<string>('');

  const { data, isLoading, error } = useWaitTimesReport(from, to, doctorId || undefined);
  const { data: doctors } = useDoctors();

  // Calculate max count for distribution bar scaling
  const maxCount = data ? Math.max(...data.distribution.map((d) => d.count), 1) : 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Wait Time Analysis</h1>
        <p className="text-sm text-gray-500 mt-1">Monitor patient wait times and consultation durations</p>
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
                              : 'bg-blue-500'
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
                              className={`h-2 rounded-full ${day.avgWaitMin > 30 ? 'bg-red-500' : 'bg-blue-500'}`}
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
        </>
      )}
    </div>
  );
}
