'use client';

import { useState } from 'react';
import { useOverviewReport } from '../../../../lib/hooks/useReports';
import { useFilteredDoctors } from '../../../../lib/hooks/useDoctors';

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function getDefaultDateRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 6);
  return { from: formatDate(from), to: formatDate(to) };
}

export default function OverviewReportPage() {
  const defaultRange = getDefaultDateRange();
  const [from, setFrom] = useState(defaultRange.from);
  const [to, setTo] = useState(defaultRange.to);
  const [doctorId, setDoctorId] = useState<string>('');

  const { data, isLoading, error } = useOverviewReport(from, to, doctorId || undefined);
  const { data: doctors } = useFilteredDoctors();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Overview Report</h1>
        <p className="text-sm text-gray-500 mt-1">Comprehensive clinic performance analytics</p>
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
        </>
      )}
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
