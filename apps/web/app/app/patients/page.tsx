'use client';

import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { searchPatients, getPatients, createPatient, updatePatient, getPatientHistory, Patient, PatientHistory } from '../../../lib/api';
import PhoneInput, { isValidPhone, isValidEmail, formatPhoneDisplay } from '../../../components/PhoneInput';
import { useAuth } from '../../../components/AuthProvider';

const ITEMS_PER_PAGE = 15;

export default function PatientsPage() {
  const queryClient = useQueryClient();
  const { isManager, clinicRole } = useAuth();

  // Check if user is doctor-only (not manager/staff) - view only for patients
  const isDoctorOnly = clinicRole === 'CLINIC_DOCTOR' && !isManager;
  const canEditPatients = !isDoctorOnly;
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [historyPatient, setHistoryPatient] = useState<Patient | null>(null);

  // Fetch patients
  const { data: allPatients, isLoading } = useQuery({
    queryKey: ['patients', search],
    queryFn: async () => {
      if (search.length >= 2) {
        const { data, error } = await searchPatients(search, 100);
        if (error) throw new Error(error.message);
        return data || [];
      } else {
        const { data, error } = await getPatients(100);
        if (error) throw new Error(error.message);
        return data || [];
      }
    },
    staleTime: 30000,
  });

  // Reset to page 1 when search changes
  const handleSearchChange = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
  };

  // Pagination logic
  const { paginatedPatients, totalPages, totalCount } = useMemo(() => {
    const patients = allPatients || [];
    const total = patients.length;
    const pages = Math.ceil(total / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginated = patients.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    return { paginatedPatients: paginated, totalPages: pages, totalCount: total };
  }, [allPatients, currentPage]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold text-gray-900">Patients</h1>
          {totalCount > 0 && (
            <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">
              {totalCount}
            </span>
          )}
        </div>
        {canEditPatients && (
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary text-xs py-1 px-2"
          >
            + New Patient
          </button>
        )}
      </div>

      {/* Search */}
      <div className="mb-2">
        <div className="relative max-w-xs">
          <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search by name or phone..."
            className="input-field pl-7 py-1.5 text-xs"
          />
        </div>
        {search.length > 0 && search.length < 2 && (
          <p className="text-[10px] text-gray-400 mt-0.5">Type at least 2 characters</p>
        )}
      </div>

      {/* Patients Table */}
      <div className="card flex-1 flex flex-col overflow-hidden">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <div className="animate-spin w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full mx-auto mb-2"></div>
              <p className="text-xs">Loading...</p>
            </div>
          </div>
        ) : !allPatients || allPatients.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <svg className="w-8 h-8 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <p className="text-xs">{search ? 'No patients found.' : 'No patients yet.'}</p>
            </div>
          </div>
        ) : (
          <>
            {/* Table */}
            <div className="flex-1 overflow-auto">
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">Patient</th>
                    <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                    <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Added</th>
                    <th className="px-2 py-1.5 text-right text-[10px] font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedPatients.map((patient) => (
                    <tr key={patient.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-2 py-1.5">
                        <div className="flex items-center gap-1.5">
                          <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-primary-700 font-medium text-[10px]">
                              {patient.fullName.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <span className="text-[11px] font-medium text-gray-900 truncate">
                            {patient.fullName}
                          </span>
                        </div>
                      </td>
                      <td className="px-2 py-1.5">
                        <span className="text-[11px] text-gray-600">
                          {patient.phone ? formatPhoneDisplay(patient.phone) : '-'}
                        </span>
                      </td>
                      <td className="px-2 py-1.5">
                        <span className="text-[11px] text-gray-500 truncate max-w-[150px] inline-block">
                          {patient.email || '-'}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 hidden md:table-cell">
                        <span className="text-[10px] text-gray-400">
                          {new Date(patient.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: '2-digit',
                          })}
                        </span>
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="flex gap-1 justify-end">
                          <button
                            onClick={() => setHistoryPatient(patient)}
                            className="text-[10px] py-0.5 px-1.5 text-indigo-600 hover:bg-indigo-50 rounded font-medium"
                          >
                            History
                          </button>
                          {canEditPatients && (
                            <button
                              onClick={() => setEditingPatient(patient)}
                              className="text-[10px] py-0.5 px-1.5 text-primary-600 hover:bg-primary-50 rounded font-medium"
                            >
                              Edit
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-2 py-1.5 border-t border-gray-100 bg-gray-50">
                <div className="text-[10px] text-gray-500">
                  {((currentPage - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, totalCount)} of {totalCount}
                </div>
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1 rounded hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    let page: number;
                    if (totalPages <= 5) {
                      page = i + 1;
                    } else if (currentPage <= 3) {
                      page = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      page = totalPages - 4 + i;
                    } else {
                      page = currentPage - 2 + i;
                    }
                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`w-6 h-6 text-[10px] rounded font-medium ${
                          page === currentPage
                            ? 'bg-primary-600 text-white'
                            : 'text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {page}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1 rounded hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Add Patient Modal */}
      {showAddModal && (
        <PatientFormModal
          mode="add"
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            queryClient.invalidateQueries({ queryKey: ['patients'] });
          }}
        />
      )}

      {/* Edit Patient Modal */}
      {editingPatient && (
        <PatientFormModal
          mode="edit"
          patient={editingPatient}
          onClose={() => setEditingPatient(null)}
          onSuccess={() => {
            setEditingPatient(null);
            queryClient.invalidateQueries({ queryKey: ['patients'] });
          }}
        />
      )}

      {/* Patient History Modal */}
      {historyPatient && (
        <PatientHistoryModal
          patient={historyPatient}
          onClose={() => setHistoryPatient(null)}
        />
      )}
    </div>
  );
}

// Unified Patient Form Modal (Add/Edit)
function PatientFormModal({
  mode,
  patient,
  onClose,
  onSuccess,
}: {
  mode: 'add' | 'edit';
  patient?: Patient;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const nameParts = patient?.fullName.split(' ') || [];
  const [firstName, setFirstName] = useState(nameParts[0] || '');
  const [lastName, setLastName] = useState(nameParts.slice(1).join(' ') || '');
  const [phone, setPhone] = useState(patient?.phone || '');
  const [email, setEmail] = useState(patient?.email || '');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError('');

    if (!firstName.trim()) {
      setError('First name is required');
      return;
    }
    if (!lastName.trim()) {
      setError('Last name is required');
      return;
    }
    if (phone && !isValidPhone(phone)) {
      setError('Phone number must be 10 digits');
      return;
    }
    if (email.trim() && !isValidEmail(email.trim())) {
      setError('Please enter a valid email address');
      return;
    }

    setSubmitting(true);
    const fullName = `${firstName.trim()} ${lastName.trim()}`;

    if (mode === 'add') {
      const { error: apiError } = await createPatient({
        fullName,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
      });
      if (apiError) {
        setError(apiError.message || 'Failed to create patient');
        setSubmitting(false);
        return;
      }
    } else {
      const { error: apiError } = await updatePatient(patient!.id, {
        fullName,
        phone: phone.trim() || undefined,
      });
      if (apiError) {
        setError(apiError.message || 'Failed to update patient');
        setSubmitting(false);
        return;
      }
    }

    onSuccess();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl w-[320px]">
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">
            {mode === 'add' ? 'Add Patient' : 'Edit Patient'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
          <div className="px-3 py-2.5 space-y-2.5">
            {error && (
              <div className="p-1.5 bg-red-50 border border-red-200 rounded text-[11px] text-red-700">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-medium text-gray-700 mb-0.5">First Name *</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First"
                  className="input-field py-1 text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-700 mb-0.5">Last Name *</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last"
                  className="input-field py-1 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-medium text-gray-700 mb-0.5">Phone</label>
              <PhoneInput
                value={phone}
                onChange={(fullPhone) => setPhone(fullPhone)}
                placeholder="10-digit number"
              />
            </div>

            <div>
              <label className="block text-[10px] font-medium text-gray-700 mb-0.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                className={`input-field py-1 text-xs ${email && !isValidEmail(email) ? 'border-red-300' : ''}`}
              />
            </div>

            {mode === 'edit' && patient && (
              <div className="bg-gray-50 rounded p-1.5 text-[10px] text-gray-500">
                Added {new Date(patient.createdAt).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </div>
            )}
          </div>

          <div className="flex gap-2 px-3 py-2 border-t border-gray-200 bg-gray-50 rounded-b-lg">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1 py-1 text-xs"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary flex-1 py-1 text-xs"
              disabled={submitting || !firstName.trim() || !lastName.trim()}
            >
              {submitting ? (mode === 'add' ? 'Adding...' : 'Saving...') : (mode === 'add' ? 'Add' : 'Save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Patient History Modal
function PatientHistoryModal({
  patient,
  onClose,
}: {
  patient: Patient;
  onClose: () => void;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['patientHistory', patient.id],
    queryFn: async () => {
      const { data, error } = await getPatientHistory(patient.id);
      if (error) throw new Error(error.message);
      return data;
    },
  });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: '2-digit',
    });
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatDuration = (start: string, end: string) => {
    const diffMs = new Date(end).getTime() - new Date(start).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    const remainMins = mins % 60;
    return remainMins > 0 ? `${hrs}h ${remainMins}m` : `${hrs}h`;
  };

  // Combine and sort all visits
  const allVisits = useMemo(() => {
    if (!data) return [];

    const visits: Array<{
      id: string;
      date: Date;
      type: 'appointment' | 'walkin';
      status: string;
      doctor: string;
      time: string;
      reason?: string;
      duration?: string;
      outcome?: string;
    }> = [];

    // Add appointments
    data.appointments.forEach((apt) => {
      visits.push({
        id: apt.id,
        date: new Date(apt.startsAt),
        type: 'appointment',
        status: apt.status,
        doctor: apt.doctor.fullName,
        time: formatTime(apt.startsAt),
        reason: apt.reason,
      });
    });

    // Add queue entries
    data.queueEntries.forEach((qe) => {
      visits.push({
        id: qe.id,
        date: new Date(qe.queueDate),
        type: qe.source === 'WALKIN' ? 'walkin' : 'appointment',
        status: qe.status,
        doctor: qe.doctor.fullName,
        time: qe.checkedInAt ? formatTime(qe.checkedInAt) : '-',
        reason: qe.reason,
        duration: qe.startedAt && qe.completedAt ? formatDuration(qe.startedAt, qe.completedAt) : undefined,
        outcome: qe.outcome,
      });
    });

    // Sort by date descending
    return visits.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [data]);

  const getStatusBadge = (status: string, outcome?: string) => {
    if (outcome === 'NO_SHOW') {
      return <span className="text-[9px] px-1 py-0.5 rounded bg-red-100 text-red-700">No Show</span>;
    }
    switch (status) {
      case 'COMPLETED':
        return <span className="text-[9px] px-1 py-0.5 rounded bg-green-100 text-green-700">Completed</span>;
      case 'CANCELLED':
        return <span className="text-[9px] px-1 py-0.5 rounded bg-gray-100 text-gray-600">Cancelled</span>;
      case 'BOOKED':
        return <span className="text-[9px] px-1 py-0.5 rounded bg-blue-100 text-blue-700">Booked</span>;
      default:
        return <span className="text-[9px] px-1 py-0.5 rounded bg-amber-100 text-amber-700">{status}</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl w-[400px] max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 flex-shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Visit History</h2>
            <p className="text-[10px] text-gray-500">{patient.fullName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full"></div>
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-500 text-xs">Failed to load history</div>
          ) : allVisits.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-xs">No visit history</div>
          ) : (
            <div className="space-y-2">
              {allVisits.map((visit) => (
                <div key={visit.id} className="bg-gray-50 rounded-lg p-2 border border-gray-200">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] px-1 py-0.5 rounded font-medium ${
                        visit.type === 'walkin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {visit.type === 'walkin' ? 'Walk-in' : 'Appt'}
                      </span>
                      {getStatusBadge(visit.status, visit.outcome)}
                    </div>
                    <span className="text-[10px] text-gray-400">{formatDate(visit.date.toISOString())}</span>
                  </div>
                  <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
                    <div>
                      <span className="text-gray-400">Doctor:</span>{' '}
                      <span className="text-gray-700">{visit.doctor}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Time:</span>{' '}
                      <span className="text-gray-700">{visit.time}</span>
                    </div>
                    {visit.reason && (
                      <div className="col-span-2">
                        <span className="text-gray-400">Reason:</span>{' '}
                        <span className="text-gray-700">{visit.reason}</span>
                      </div>
                    )}
                    {visit.duration && (
                      <div>
                        <span className="text-gray-400">Duration:</span>{' '}
                        <span className="text-gray-700">{visit.duration}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-3 py-2 border-t border-gray-200 bg-gray-50 rounded-b-lg flex-shrink-0">
          <button
            onClick={onClose}
            className="btn-secondary w-full py-1 text-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
