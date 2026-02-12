'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  usePatientsReport,
  useQueueReport,
  useAppointmentsReport,
  useDoctorCheckinsReport,
  PatientReportItem,
  QueueReportItem,
  AppointmentReportItem,
  DoctorCheckinItem,
} from '../../../lib/hooks/useReports';
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

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function formatDisplayDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

type TabType = 'patients' | 'queue' | 'appointments' | 'checkins';
type SortDirection = 'asc' | 'desc';

const STATUS_COLORS: Record<string, string> = {
  QUEUED: 'bg-blue-100 text-blue-800 border border-blue-200',
  WAITING: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
  WITH_DOCTOR: 'bg-purple-100 text-purple-800 border border-purple-200',
  COMPLETED: 'bg-green-100 text-green-800 border border-green-200',
  CANCELLED: 'bg-red-100 text-red-800 border border-red-200',
  BOOKED: 'bg-blue-100 text-blue-800 border border-blue-200',
  CHECKED_IN: 'bg-indigo-100 text-indigo-800 border border-indigo-200',
  NO_SHOW: 'bg-orange-100 text-orange-800 border border-orange-200',
  RESCHEDULED: 'bg-gray-100 text-gray-800 border border-gray-200',
};

const PRIORITY_COLORS: Record<string, string> = {
  NORMAL: 'bg-gray-100 text-gray-700 border border-gray-200',
  URGENT: 'bg-orange-100 text-orange-800 border border-orange-200',
  EMERGENCY: 'bg-red-100 text-red-800 border border-red-200',
};

// Icons as SVG components
function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  );
}

function QueueIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
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

function ChevronUpDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15L12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
    </svg>
  );
}

function ChevronUpIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
  );
}

// Sortable table header component
function SortableHeader({
  label,
  sortKey,
  currentSort,
  onSort,
  align = 'left',
}: {
  label: string;
  sortKey: string;
  currentSort: { key: string; direction: SortDirection };
  onSort: (key: string) => void;
  align?: 'left' | 'right';
}) {
  const isActive = currentSort.key === sortKey;
  return (
    <th
      className={`px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
      onClick={() => onSort(sortKey)}
    >
      <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : ''}`}>
        {label}
        <span className="w-4 h-4">
          {isActive ? (
            currentSort.direction === 'asc' ? (
              <ChevronUpIcon className="w-4 h-4 text-primary-600" />
            ) : (
              <ChevronDownIcon className="w-4 h-4 text-primary-600" />
            )
          ) : (
            <ChevronUpDownIcon className="w-4 h-4 text-gray-400" />
          )}
        </span>
      </div>
    </th>
  );
}

// Summary card component
function SummaryCard({
  icon: Icon,
  label,
  value,
  subValue,
  color = 'primary',
}: {
  icon: React.FC<{ className?: string }>;
  label: string;
  value: string | number;
  subValue?: string;
  color?: 'primary' | 'green' | 'blue' | 'orange';
}) {
  const colorClasses = {
    primary: 'bg-primary-50 text-primary-600 border-primary-200',
    green: 'bg-green-50 text-green-600 border-green-200',
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    orange: 'bg-orange-50 text-orange-600 border-orange-200',
  };

  const iconBgClasses = {
    primary: 'bg-primary-100',
    green: 'bg-green-100',
    blue: 'bg-blue-100',
    orange: 'bg-orange-100',
  };

  return (
    <div className={`rounded-xl border p-4 ${colorClasses[color]}`}>
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${iconBgClasses[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide opacity-80">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
          {subValue && <p className="text-xs opacity-70">{subValue}</p>}
        </div>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('patients');
  const defaultRange = getDefaultDateRange();
  const [from, setFrom] = useState(defaultRange.from);
  const [to, setTo] = useState(defaultRange.to);
  const [doctorId, setDoctorId] = useState<string>('');
  const [status, setStatus] = useState<string>('');

  const { data: doctors, currentDoctorId, canViewAllDoctors } = useFilteredDoctors();

  // Auto-select doctor for doctor-only users (not managers)
  useEffect(() => {
    if (currentDoctorId && !doctorId) {
      setDoctorId(currentDoctorId);
    }
  }, [currentDoctorId, doctorId]);

  const tabs = [
    { key: 'patients', label: 'Patients', icon: UsersIcon },
    { key: 'queue', label: 'Daily Queue', icon: QueueIcon },
    { key: 'appointments', label: 'Appointments', icon: CalendarIcon },
    { key: 'checkins', label: 'Doctor Check-ins', icon: ClockIcon },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-sm text-gray-500 mt-1">View detailed reports and data exports</p>
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
          {activeTab !== 'patients' && (
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
          )}
          {(activeTab === 'queue' || activeTab === 'appointments') && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="px-3 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm min-w-[160px] bg-white"
              >
                <option value="">All Statuses</option>
                {activeTab === 'queue' && (
                  <>
                    <option value="QUEUED">Queued</option>
                    <option value="WAITING">Waiting</option>
                    <option value="WITH_DOCTOR">With Doctor</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="CANCELLED">Cancelled</option>
                  </>
                )}
                {activeTab === 'appointments' && (
                  <>
                    <option value="BOOKED">Booked</option>
                    <option value="CHECKED_IN">Checked In</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="CANCELLED">Cancelled</option>
                    <option value="NO_SHOW">No Show</option>
                    <option value="RESCHEDULED">Rescheduled</option>
                  </>
                )}
              </select>
            </div>
          )}
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
                  onClick={() => {
                    setActiveTab(tab.key as TabType);
                    setStatus('');
                  }}
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
          {activeTab === 'patients' && <PatientsTab from={from} to={to} />}
          {activeTab === 'queue' && (
            <QueueTab from={from} to={to} doctorId={doctorId} status={status} />
          )}
          {activeTab === 'appointments' && (
            <AppointmentsTab from={from} to={to} doctorId={doctorId} status={status} />
          )}
          {activeTab === 'checkins' && (
            <CheckinsTab from={from} to={to} doctorId={doctorId} />
          )}
        </div>
      </div>
    </div>
  );
}

// Patients Tab
function PatientsTab({ from, to }: { from: string; to: string }) {
  const { data, isLoading, error } = usePatientsReport({ from, to, limit: 100 });
  const [sort, setSort] = useState<{ key: string; direction: SortDirection }>({
    key: 'fullName',
    direction: 'asc',
  });

  const handleSort = (key: string) => {
    setSort((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const sortedPatients = useMemo(() => {
    if (!data?.patients) return [];
    return [...data.patients].sort((a, b) => {
      const aVal = a[sort.key as keyof PatientReportItem];
      const bVal = b[sort.key as keyof PatientReportItem];
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sort.direction === 'asc' ? aVal - bVal : bVal - aVal;
      }
      const comparison = String(aVal).localeCompare(String(bVal));
      return sort.direction === 'asc' ? comparison : -comparison;
    });
  }, [data?.patients, sort]);

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
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
        Failed to load report: {error.message}
      </div>
    );
  }

  if (!data) return null;

  const newPatientsCount = data.patients.filter(
    (p) => p.totalVisits === 1 || p.totalVisits === 0
  ).length;
  const returningPatientsCount = data.patients.filter((p) => p.totalVisits > 1).length;

  return (
    <div className="space-y-5">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard
          icon={UsersIcon}
          label="Total Patients"
          value={data.total}
          subValue={`${from} to ${to}`}
          color="primary"
        />
        <SummaryCard
          icon={UsersIcon}
          label="New Patients"
          value={newPatientsCount}
          subValue="First visit"
          color="green"
        />
        <SummaryCard
          icon={UsersIcon}
          label="Returning"
          value={returningPatientsCount}
          subValue="Multiple visits"
          color="blue"
        />
      </div>

      {/* Table */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <SortableHeader label="Patient Name" sortKey="fullName" currentSort={sort} onSort={handleSort} />
                <SortableHeader label="Phone" sortKey="phone" currentSort={sort} onSort={handleSort} />
                <SortableHeader label="Email" sortKey="email" currentSort={sort} onSort={handleSort} />
                <SortableHeader label="Registered" sortKey="createdAt" currentSort={sort} onSort={handleSort} />
                <SortableHeader label="Last Visit" sortKey="lastVisitDate" currentSort={sort} onSort={handleSort} />
                <SortableHeader label="Total Visits" sortKey="totalVisits" currentSort={sort} onSort={handleSort} align="right" />
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {sortedPatients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <div className="text-gray-400">
                      <UsersIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p className="text-sm font-medium">No patients found</p>
                      <p className="text-xs text-gray-400 mt-1">Try adjusting your date range</p>
                    </div>
                  </td>
                </tr>
              ) : (
                sortedPatients.map((patient, idx) => (
                  <tr key={patient.id} className={`hover:bg-gray-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {patient.fullName}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {patient.phone || <span className="text-gray-400">-</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {patient.email || <span className="text-gray-400">-</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {formatDisplayDate(patient.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {patient.lastVisitDate ? formatDisplayDate(patient.lastVisitDate) : <span className="text-gray-400">-</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        patient.totalVisits > 5
                          ? 'bg-green-100 text-green-800'
                          : patient.totalVisits > 1
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {patient.totalVisits}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {sortedPatients.length > 0 && (
          <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 text-xs text-gray-500">
            Showing {sortedPatients.length} of {data.total} patients
          </div>
        )}
      </div>
    </div>
  );
}

// Queue Tab
function QueueTab({
  from,
  to,
  doctorId,
  status,
}: {
  from: string;
  to: string;
  doctorId: string;
  status: string;
}) {
  const { data, isLoading, error } = useQueueReport(from, to, {
    doctorId: doctorId || undefined,
    status: status || undefined,
  });
  const [sort, setSort] = useState<{ key: string; direction: SortDirection }>({
    key: 'date',
    direction: 'desc',
  });

  const handleSort = (key: string) => {
    setSort((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const sortedEntries = useMemo(() => {
    if (!data?.entries) return [];
    return [...data.entries].sort((a, b) => {
      const aVal = a[sort.key as keyof QueueReportItem];
      const bVal = b[sort.key as keyof QueueReportItem];
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sort.direction === 'asc' ? aVal - bVal : bVal - aVal;
      }
      const comparison = String(aVal).localeCompare(String(bVal));
      return sort.direction === 'asc' ? comparison : -comparison;
    });
  }, [data?.entries, sort]);

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
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
        Failed to load report: {error.message}
      </div>
    );
  }

  if (!data) return null;

  const completedCount = data.entries.filter((e) => e.status === 'COMPLETED').length;
  const avgWait = data.entries.filter((e) => e.waitMinutes !== null).length > 0
    ? Math.round(
        data.entries
          .filter((e) => e.waitMinutes !== null)
          .reduce((sum, e) => sum + (e.waitMinutes || 0), 0) /
          data.entries.filter((e) => e.waitMinutes !== null).length
      )
    : 0;
  const walkinCount = data.entries.filter((e) => e.source === 'WALKIN').length;

  return (
    <div className="space-y-5">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <SummaryCard
          icon={QueueIcon}
          label="Total Entries"
          value={data.total}
          color="primary"
        />
        <SummaryCard
          icon={UsersIcon}
          label="Completed"
          value={completedCount}
          subValue={`${data.total > 0 ? Math.round((completedCount / data.total) * 100) : 0}%`}
          color="green"
        />
        <SummaryCard
          icon={ClockIcon}
          label="Avg Wait"
          value={`${avgWait} min`}
          color={avgWait > 30 ? 'orange' : 'blue'}
        />
        <SummaryCard
          icon={UsersIcon}
          label="Walk-ins"
          value={walkinCount}
          subValue={`${data.total > 0 ? Math.round((walkinCount / data.total) * 100) : 0}%`}
          color="blue"
        />
      </div>

      {/* Table */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <SortableHeader label="Date" sortKey="date" currentSort={sort} onSort={handleSort} />
                <SortableHeader label="#" sortKey="position" currentSort={sort} onSort={handleSort} />
                <SortableHeader label="Patient" sortKey="patientName" currentSort={sort} onSort={handleSort} />
                <SortableHeader label="Doctor" sortKey="doctorName" currentSort={sort} onSort={handleSort} />
                <SortableHeader label="Status" sortKey="status" currentSort={sort} onSort={handleSort} />
                <SortableHeader label="Source" sortKey="source" currentSort={sort} onSort={handleSort} />
                <SortableHeader label="Priority" sortKey="priority" currentSort={sort} onSort={handleSort} />
                <SortableHeader label="Check-in" sortKey="checkedInAt" currentSort={sort} onSort={handleSort} />
                <SortableHeader label="Wait" sortKey="waitMinutes" currentSort={sort} onSort={handleSort} align="right" />
                <SortableHeader label="Consult" sortKey="consultMinutes" currentSort={sort} onSort={handleSort} align="right" />
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {sortedEntries.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center">
                    <div className="text-gray-400">
                      <QueueIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p className="text-sm font-medium">No queue entries found</p>
                      <p className="text-xs text-gray-400 mt-1">Try adjusting your filters</p>
                    </div>
                  </td>
                </tr>
              ) : (
                sortedEntries.map((entry, idx) => (
                  <tr key={entry.id} className={`hover:bg-gray-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                    <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                      {formatDisplayDate(entry.date)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 text-xs font-semibold text-gray-700">
                        {entry.position}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {entry.patientName}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{entry.doctorName}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${
                          STATUS_COLORS[entry.status] || 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {entry.status.replace('_', ' ')}
                        {entry.outcome && entry.outcome !== 'DONE' && ` (${entry.outcome})`}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${
                        entry.source === 'WALKIN' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'
                      }`}>
                        {entry.source}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${
                          PRIORITY_COLORS[entry.priority] || 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {entry.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                      {formatTime(entry.checkedInAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {entry.waitMinutes !== null ? (
                        <span className={`text-sm font-medium ${entry.waitMinutes > 30 ? 'text-orange-600' : 'text-gray-900'}`}>
                          {entry.waitMinutes}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {entry.consultMinutes !== null ? (
                        <span className="text-sm font-medium text-gray-900">{entry.consultMinutes}</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {sortedEntries.length > 0 && (
          <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 text-xs text-gray-500">
            Showing {sortedEntries.length} of {data.total} entries
          </div>
        )}
      </div>
    </div>
  );
}

// Appointments Tab
function AppointmentsTab({
  from,
  to,
  doctorId,
  status,
}: {
  from: string;
  to: string;
  doctorId: string;
  status: string;
}) {
  const { data, isLoading, error } = useAppointmentsReport(from, to, {
    doctorId: doctorId || undefined,
    status: status || undefined,
  });
  const [sort, setSort] = useState<{ key: string; direction: SortDirection }>({
    key: 'date',
    direction: 'desc',
  });

  const handleSort = (key: string) => {
    setSort((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const sortedAppointments = useMemo(() => {
    if (!data?.appointments) return [];
    return [...data.appointments].sort((a, b) => {
      const aVal = a[sort.key as keyof AppointmentReportItem];
      const bVal = b[sort.key as keyof AppointmentReportItem];
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sort.direction === 'asc' ? aVal - bVal : bVal - aVal;
      }
      const comparison = String(aVal).localeCompare(String(bVal));
      return sort.direction === 'asc' ? comparison : -comparison;
    });
  }, [data?.appointments, sort]);

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
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
        Failed to load report: {error.message}
      </div>
    );
  }

  if (!data) return null;

  const completedCount = data.appointments.filter((a) => a.status === 'COMPLETED').length;
  const noShowCount = data.appointments.filter((a) => a.status === 'NO_SHOW').length;
  const cancelledCount = data.appointments.filter((a) => a.status === 'CANCELLED').length;

  return (
    <div className="space-y-5">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <SummaryCard
          icon={CalendarIcon}
          label="Total"
          value={data.total}
          color="primary"
        />
        <SummaryCard
          icon={UsersIcon}
          label="Completed"
          value={completedCount}
          subValue={`${data.total > 0 ? Math.round((completedCount / data.total) * 100) : 0}%`}
          color="green"
        />
        <SummaryCard
          icon={ClockIcon}
          label="No Shows"
          value={noShowCount}
          subValue={`${data.total > 0 ? Math.round((noShowCount / data.total) * 100) : 0}%`}
          color="orange"
        />
        <SummaryCard
          icon={CalendarIcon}
          label="Cancelled"
          value={cancelledCount}
          color="blue"
        />
      </div>

      {/* Table */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <SortableHeader label="Date" sortKey="date" currentSort={sort} onSort={handleSort} />
                <SortableHeader label="Time" sortKey="time" currentSort={sort} onSort={handleSort} />
                <SortableHeader label="Patient" sortKey="patientName" currentSort={sort} onSort={handleSort} />
                <SortableHeader label="Phone" sortKey="patientPhone" currentSort={sort} onSort={handleSort} />
                <SortableHeader label="Doctor" sortKey="doctorName" currentSort={sort} onSort={handleSort} />
                <SortableHeader label="Status" sortKey="status" currentSort={sort} onSort={handleSort} />
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Reason
                </th>
                <SortableHeader label="Created" sortKey="createdAt" currentSort={sort} onSort={handleSort} />
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {sortedAppointments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <div className="text-gray-400">
                      <CalendarIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p className="text-sm font-medium">No appointments found</p>
                      <p className="text-xs text-gray-400 mt-1">Try adjusting your filters</p>
                    </div>
                  </td>
                </tr>
              ) : (
                sortedAppointments.map((appt, idx) => (
                  <tr key={appt.id} className={`hover:bg-gray-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                    <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                      {formatDisplayDate(appt.date)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap font-medium">
                      {formatTime(appt.time)}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {appt.patientName}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {appt.patientPhone || <span className="text-gray-400">-</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{appt.doctorName}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${
                          STATUS_COLORS[appt.status] || 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {appt.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate" title={appt.reason || undefined}>
                      {appt.reason || <span className="text-gray-400">-</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                      {formatDateTime(appt.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {sortedAppointments.length > 0 && (
          <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 text-xs text-gray-500">
            Showing {sortedAppointments.length} of {data.total} appointments
          </div>
        )}
      </div>
    </div>
  );
}

// Check-ins Tab
function CheckinsTab({
  from,
  to,
  doctorId,
}: {
  from: string;
  to: string;
  doctorId: string;
}) {
  const { data, isLoading, error } = useDoctorCheckinsReport(
    from,
    to,
    doctorId || undefined
  );
  const [sort, setSort] = useState<{ key: string; direction: SortDirection }>({
    key: 'date',
    direction: 'desc',
  });

  const handleSort = (key: string) => {
    setSort((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const sortedCheckins = useMemo(() => {
    if (!data?.checkins) return [];
    return [...data.checkins].sort((a, b) => {
      const aVal = a[sort.key as keyof DoctorCheckinItem];
      const bVal = b[sort.key as keyof DoctorCheckinItem];
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sort.direction === 'asc' ? aVal - bVal : bVal - aVal;
      }
      const comparison = String(aVal).localeCompare(String(bVal));
      return sort.direction === 'asc' ? comparison : -comparison;
    });
  }, [data?.checkins, sort]);

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
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
        Failed to load report: {error.message}
      </div>
    );
  }

  if (!data) return null;

  const totalHours = data.checkins.reduce((sum, c) => sum + (c.hoursWorked || 0), 0);
  const avgHours = data.checkins.length > 0 ? (totalHours / data.checkins.length).toFixed(1) : '0';
  const completedShifts = data.checkins.filter((c) => c.checkOutTime !== null).length;

  return (
    <div className="space-y-5">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <SummaryCard
          icon={ClockIcon}
          label="Total Check-ins"
          value={data.total}
          color="primary"
        />
        <SummaryCard
          icon={ClockIcon}
          label="Completed Shifts"
          value={completedShifts}
          subValue={`${data.total > 0 ? Math.round((completedShifts / data.total) * 100) : 0}%`}
          color="green"
        />
        <SummaryCard
          icon={ClockIcon}
          label="Total Hours"
          value={`${totalHours.toFixed(1)}h`}
          color="blue"
        />
        <SummaryCard
          icon={ClockIcon}
          label="Avg Hours/Day"
          value={`${avgHours}h`}
          color="blue"
        />
      </div>

      {/* Table */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <SortableHeader label="Date" sortKey="date" currentSort={sort} onSort={handleSort} />
                <SortableHeader label="Doctor" sortKey="doctorName" currentSort={sort} onSort={handleSort} />
                <SortableHeader label="Check-in Time" sortKey="checkInTime" currentSort={sort} onSort={handleSort} />
                <SortableHeader label="Check-out Time" sortKey="checkOutTime" currentSort={sort} onSort={handleSort} />
                <SortableHeader label="Hours Worked" sortKey="hoursWorked" currentSort={sort} onSort={handleSort} align="right" />
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {sortedCheckins.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <div className="text-gray-400">
                      <ClockIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p className="text-sm font-medium">No check-ins found</p>
                      <p className="text-xs text-gray-400 mt-1">Try adjusting your filters</p>
                    </div>
                  </td>
                </tr>
              ) : (
                sortedCheckins.map((checkin, idx) => (
                  <tr key={checkin.id} className={`hover:bg-gray-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                    <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                      {formatDisplayDate(checkin.date)}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {checkin.doctorName}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 text-green-700">
                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                        {formatTime(checkin.checkInTime)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      {checkin.checkOutTime ? (
                        <span className="inline-flex items-center gap-1.5 text-red-700">
                          <span className="w-2 h-2 rounded-full bg-red-500"></span>
                          {formatTime(checkin.checkOutTime)}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-amber-600">
                          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {checkin.hoursWorked !== null ? (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          checkin.hoursWorked >= 8
                            ? 'bg-green-100 text-green-800'
                            : checkin.hoursWorked >= 4
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {checkin.hoursWorked}h
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {sortedCheckins.length > 0 && (
          <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 text-xs text-gray-500">
            Showing {sortedCheckins.length} of {data.total} check-ins
          </div>
        )}
      </div>
    </div>
  );
}
