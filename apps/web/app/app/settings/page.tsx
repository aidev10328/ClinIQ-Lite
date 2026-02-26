'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../components/AuthProvider';
import PhoneInput, { isValidPhone, isValidEmail, formatPhoneDisplay } from '../../../components/PhoneInput';
import {
  managerGetStats,
  managerListDoctors,
  managerCreateDoctor,
  managerUpdateDoctor,
  managerDeactivateDoctor,
  managerGetLicenseInfo,
  managerAssignLicense,
  managerRevokeLicense,
  managerListStaff,
  managerAddStaff,
  managerRemoveStaff,
  managerGetLicensedDoctors,
  managerUpdateStaffDoctors,
  getDoctorScheduleData,
  updateDoctorSchedule,
  checkScheduleConflicts,
  updateScheduleWithConflicts,
  createTimeOff,
  deleteTimeOff,
  getSpecializations,
  getClinicTime,
  Specialization,
  ManagerDoctor,
  ManagerStaff,
  ManagerLicenseInfo,
  ManagerClinicStats,
  CreateManagerDoctorData,
  CreateStaffData,
  UpdateSchedulePayload,
  ShiftType,
  TimeOffType,
  ConflictingAppointment,
  ScheduleConflictCheckResult,
  AssignedDoctor,
} from '../../../lib/api';
import {
  TIME_OPTIONS,
  DURATION_OPTIONS,
  DAY_NAMES,
  SHIFT_TYPES,
  SHIFT_LABELS,
  SHIFT_ICONS,
  formatTime,
  formatDateLocal,
} from '../../../lib/utils';

type ViewMode = 'list' | 'add-doctor' | 'edit-doctor';

export default function SettingsPage() {
  const { clinic, isManager, loading } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'doctors' | 'staff' | 'licenses'>('doctors');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null);
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);

  useEffect(() => {
    if (!loading && !isManager) {
      router.replace('/app/queue');
    }
  }, [isManager, loading, router]);

  // Get stable clinic ID - only use when clinic is loaded
  const clinicId = clinic?.id;

  // Ensure queries only run after auth is fully loaded and user is manager with valid clinic
  const canFetchManagerData = !loading && isManager && !!clinicId;

  // Clear stale queries when clinic changes
  useEffect(() => {
    if (clinicId) {
      // Invalidate manager queries to ensure fresh data for this clinic
      queryClient.invalidateQueries({ queryKey: ['manager'] });
    }
  }, [clinicId, queryClient]);

  const { data: stats, isLoading: statsLoading, error: statsError, refetch: refetchStats } = useQuery({
    queryKey: ['manager', 'stats', clinicId],
    queryFn: async () => {
      if (!clinicId) throw new Error('No clinic ID');
      const { data, error } = await managerGetStats();
      if (error) throw new Error(error.message);
      return data;
    },
    enabled: canFetchManagerData,
    staleTime: 30 * 1000, // 30 seconds
  });

  // Fetch clinic time (for timezone-aware "today" highlighting in calendar)
  const { data: clinicTime } = useQuery({
    queryKey: ['clinicTime'],
    queryFn: async () => {
      const { data, error } = await getClinicTime();
      if (error) throw new Error(error.message);
      return data;
    },
    staleTime: 60 * 1000, // 1 minute
  });

  const { data: doctors, isLoading: doctorsLoading, error: doctorsError, refetch: refetchDoctors } = useQuery({
    queryKey: ['manager', 'doctors', clinicId],
    queryFn: async () => {
      if (!clinicId) throw new Error('No clinic ID');
      const { data, error } = await managerListDoctors();
      if (error) throw new Error(error.message);
      return data;
    },
    enabled: canFetchManagerData,
    staleTime: 30 * 1000, // 30 seconds
  });

  const { data: licenseInfo, isLoading: licenseLoading, error: licenseError, refetch: refetchLicense } = useQuery({
    queryKey: ['manager', 'licenses', clinicId],
    queryFn: async () => {
      if (!clinicId) throw new Error('No clinic ID');
      const { data, error } = await managerGetLicenseInfo();
      if (error) throw new Error(error.message);
      return data;
    },
    enabled: canFetchManagerData,
    staleTime: 30 * 1000, // 30 seconds
  });

  const { data: staff, isLoading: staffLoading, error: staffError, refetch: refetchStaff } = useQuery({
    queryKey: ['manager', 'staff', clinicId],
    queryFn: async () => {
      if (!clinicId) throw new Error('No clinic ID');
      const { data, error } = await managerListStaff();
      if (error) throw new Error(error.message);
      return data;
    },
    enabled: canFetchManagerData,
    staleTime: 30 * 1000, // 30 seconds
  });

  // Collect any errors
  const hasError = statsError || doctorsError || licenseError || staffError;
  const isAnyLoading = statsLoading || doctorsLoading || licenseLoading || staffLoading;

  // Manual refetch all data
  const refetchAll = () => {
    refetchStats();
    refetchDoctors();
    refetchLicense();
    refetchStaff();
  };

  const handleAddDoctor = () => {
    setViewMode('add-doctor');
    setSelectedDoctorId(null);
  };

  const handleEditDoctor = (doctor: ManagerDoctor) => {
    setSelectedDoctorId(doctor.id);
    setViewMode('edit-doctor');
  };

  const handleBackToList = () => {
    setViewMode('list');
    setSelectedDoctorId(null);
  };

  if (loading) {
    return <div className="text-gray-500 text-xs">Loading...</div>;
  }

  if (!isManager) {
    return null;
  }

  if (viewMode === 'add-doctor') {
    return (
      <AddDoctorView
        onBack={handleBackToList}
        onCreated={(doctorId) => {
          setSelectedDoctorId(doctorId);
          setViewMode('edit-doctor');
        }}
      />
    );
  }

  if (viewMode === 'edit-doctor' && selectedDoctorId) {
    const selectedDoctor = doctors?.find(d => d.id === selectedDoctorId);
    return (
      <EditDoctorView
        doctorId={selectedDoctorId}
        doctor={selectedDoctor}
        licenseInfo={licenseInfo}
        clinicTime={clinicTime}
        onBack={handleBackToList}
      />
    );
  }

  return (
    <div>
      {/* Error banner */}
      {hasError && (
        <div className="bg-red-50 border border-red-200 rounded p-2 mb-3 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-red-800">Error loading data</p>
            <p className="text-[10px] text-red-600">
              {(doctorsError as Error)?.message || (staffError as Error)?.message || (licenseError as Error)?.message || 'Unknown error'}
            </p>
          </div>
          <button onClick={refetchAll} className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200">
            Retry
          </button>
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Team Management</h1>
          <p className="text-[10px] text-gray-500">{clinic?.name}</p>
        </div>
        <button
          onClick={refetchAll}
          disabled={isAnyLoading}
          className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded disabled:opacity-50"
          title="Refresh data"
        >
          <svg className={`w-4 h-4 ${isAnyLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* License Summary - Compact */}
      {licenseInfo && (
        <div className="bg-white rounded border border-gray-200 p-2 mb-3">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-4 flex-1">
              <div className="text-center">
                <p className="text-lg font-bold text-gray-900">{licenseInfo.total}</p>
                <p className="text-[10px] text-gray-500">Total</p>
              </div>
              <div className="h-6 border-l border-gray-200" />
              <div className="text-center">
                <p className="text-lg font-bold text-blue-600">{licenseInfo.used}</p>
                <p className="text-[10px] text-gray-500">Used</p>
              </div>
              <div className="h-6 border-l border-gray-200" />
              <div className="text-center">
                <p className="text-lg font-bold text-green-600">{licenseInfo.available}</p>
                <p className="text-[10px] text-gray-500">Available</p>
              </div>
            </div>
            <div className="w-32">
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div
                  className="bg-blue-600 h-1.5 rounded-full"
                  style={{ width: `${licenseInfo.total > 0 ? (licenseInfo.used / licenseInfo.total) * 100 : 0}%` }}
                />
              </div>
              <p className="text-[10px] text-gray-500 mt-0.5 text-center">
                {licenseInfo.total > 0 ? Math.round((licenseInfo.used / licenseInfo.total) * 100) : 0}%
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tabs - Compact */}
      <div className="flex gap-1 mb-3 border-b border-gray-200">
        {(['doctors', 'staff', 'licenses'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 text-xs font-medium border-b-2 -mb-px ${
              activeTab === tab
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'doctors' && `Doctors (${doctors?.length || 0})`}
            {tab === 'staff' && `Staff (${staff?.length || 0})`}
            {tab === 'licenses' && 'Licenses'}
          </button>
        ))}
      </div>

      {activeTab === 'doctors' && (
        <DoctorsTab
          doctors={doctors || []}
          loading={doctorsLoading}
          licenseInfo={licenseInfo}
          onAddDoctor={handleAddDoctor}
          onEditDoctor={handleEditDoctor}
        />
      )}

      {activeTab === 'staff' && (
        <StaffTab
          staff={staff || []}
          loading={staffLoading}
          onAddStaff={() => setShowAddStaffModal(true)}
        />
      )}

      {activeTab === 'licenses' && (
        <LicensesTab licenseInfo={licenseInfo} stats={stats} />
      )}

      {showAddStaffModal && (
        <AddStaffModal onClose={() => setShowAddStaffModal(false)} />
      )}
    </div>
  );
}

// Doctors Tab - Compact
function DoctorsTab({
  doctors,
  loading,
  licenseInfo,
  onAddDoctor,
  onEditDoctor,
}: {
  doctors: ManagerDoctor[];
  loading: boolean;
  licenseInfo?: ManagerLicenseInfo | null;
  onAddDoctor: () => void;
  onEditDoctor: (doctor: ManagerDoctor) => void;
}) {
  const queryClient = useQueryClient();

  const assignMutation = useMutation({
    mutationFn: async (doctorId: string) => {
      const { error } = await managerAssignLicense(doctorId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['manager'] }),
  });

  const revokeMutation = useMutation({
    mutationFn: async (doctorId: string) => {
      const { error } = await managerRevokeLicense(doctorId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['manager'] }),
  });

  const deactivateMutation = useMutation({
    mutationFn: async (doctorId: string) => {
      const { error } = await managerDeactivateDoctor(doctorId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['manager'] }),
  });

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <p className="text-[10px] text-gray-600">
          {doctors.filter(d => d.isActive).length} active, {doctors.filter(d => d.hasLicense).length} licensed
        </p>
        <button onClick={onAddDoctor} className="px-2 py-1 bg-primary-600 text-white rounded text-xs font-medium hover:bg-primary-700">
          + Add Doctor
        </button>
      </div>

      {loading ? (
        <div className="text-gray-500 py-4 text-center text-xs">Loading...</div>
      ) : doctors.length === 0 ? (
        <div className="bg-white rounded border border-gray-200 text-center py-6">
          <p className="text-xs text-gray-500 mb-2">No doctors registered yet.</p>
          <button onClick={onAddDoctor} className="px-2 py-1 bg-primary-600 text-white rounded text-xs font-medium">
            Add First Doctor
          </button>
        </div>
      ) : (
        <div className="bg-white rounded border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase">Doctor</th>
                <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase">Contact</th>
                <th className="px-2 py-1.5 text-center text-[10px] font-medium text-gray-500 uppercase">License</th>
                <th className="px-2 py-1.5 text-center text-[10px] font-medium text-gray-500 uppercase">Status</th>
                <th className="px-2 py-1.5 text-right text-[10px] font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {doctors.map((doctor) => (
                <tr key={doctor.id} className="hover:bg-gray-50">
                  <td className="px-2 py-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-primary-700 text-[10px] font-medium">{doctor.fullName.charAt(0)}</span>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-900">{doctor.fullName}</p>
                        <p className="text-[10px] text-gray-500">{doctor.specialization}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-1.5">
                    <p className="text-[10px] text-gray-900">{doctor.email || '-'}</p>
                    <p className="text-[10px] text-gray-500">{doctor.phone || '-'}</p>
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    {doctor.hasLicense ? (
                      <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-green-100 text-green-800">Yes</span>
                    ) : (
                      <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-gray-100 text-gray-600">No</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded-full ${
                      doctor.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {doctor.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => onEditDoctor(doctor)}
                        className="text-primary-600 hover:text-primary-800 text-[10px] font-medium"
                      >
                        Manage
                      </button>
                      {doctor.isActive && (
                        <>
                          {doctor.hasLicense ? (
                            <button
                              onClick={() => { if (confirm('Revoke license?')) revokeMutation.mutate(doctor.id); }}
                              disabled={revokeMutation.isPending}
                              className="text-orange-600 hover:text-orange-800 text-[10px]"
                            >
                              Revoke
                            </button>
                          ) : (
                            <button
                              onClick={() => assignMutation.mutate(doctor.id)}
                              disabled={assignMutation.isPending || (licenseInfo?.available || 0) <= 0}
                              className="text-green-600 hover:text-green-800 text-[10px] disabled:opacity-50"
                            >
                              Assign
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Add Doctor View - Compact
function AddDoctorView({
  onBack,
  onCreated,
}: {
  onBack: () => void;
  onCreated: (doctorId: string) => void;
}) {
  const queryClient = useQueryClient();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [appointmentDurationMin, setAppointmentDurationMin] = useState(10);
  const [createUserAccount, setCreateUserAccount] = useState(false);
  const [password, setPassword] = useState('');
  const [isManager, setIsManager] = useState(false);
  const [error, setError] = useState('');

  const { data: specializations } = useQuery({
    queryKey: ['specializations'],
    queryFn: async () => {
      const { data, error } = await getSpecializations();
      if (error) throw new Error(error.message);
      return data || [];
    },
  });

  const handleSubmit = () => {
    if (!firstName.trim()) { setError('First name is required'); return; }
    if (!lastName.trim()) { setError('Last name is required'); return; }
    if (!specialization) { setError('Specialization is required'); return; }
    if (phone && !isValidPhone(phone)) { setError('Phone must be 10 digits'); return; }
    if (createUserAccount) {
      if (!email.trim()) { setError('Email is required for login account'); return; }
      if (!isValidEmail(email.trim())) { setError('Invalid email'); return; }
      if (!password || password.length < 6) { setError('Password must be at least 6 characters'); return; }
    } else {
      if (email.trim() && !isValidEmail(email.trim())) { setError('Invalid email'); return; }
    }
    mutation.mutate();
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await managerCreateDoctor({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        specialization,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        appointmentDurationMin,
        createUserAccount,
        password: createUserAccount ? password : undefined,
        isManager: createUserAccount ? isManager : undefined,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['manager'] });
      if (data?.id) onCreated(data.id);
      else onBack();
    },
    onError: (err: Error) => setError(err.message),
  });

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-3">
        <button onClick={onBack} className="p-1 rounded hover:bg-gray-100">
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-sm font-semibold text-gray-900">Add New Doctor</h1>
      </div>

      <div className="bg-white rounded border border-gray-200 p-3">
        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
          <div className="space-y-3">
            {error && <div className="bg-red-50 border border-red-200 rounded p-2 text-xs text-red-700">{error}</div>}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">First Name *</label>
                <input type="text" required value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-primary-500" placeholder="John" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Last Name *</label>
                <input type="text" required value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-primary-500" placeholder="Smith" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Specialization *</label>
                {specializations && specializations.length > 0 ? (
                  <select required value={specialization} onChange={(e) => setSpecialization(e.target.value)} className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-primary-500">
                    <option value="">Select...</option>
                    {specializations.map((spec) => (<option key={spec.id} value={spec.value}>{spec.value}</option>))}
                  </select>
                ) : (
                  <input type="text" required value={specialization} onChange={(e) => setSpecialization(e.target.value)} className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-primary-500" placeholder="Cardiology" />
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Duration</label>
                <select value={appointmentDurationMin} onChange={(e) => setAppointmentDurationMin(parseInt(e.target.value))} className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-primary-500">
                  {DURATION_OPTIONS.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Phone</label>
                <PhoneInput value={phone} onChange={(fullPhone) => setPhone(fullPhone)} placeholder="10-digit" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Email {createUserAccount && '*'}</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-primary-500" placeholder="doctor@example.com" required={createUserAccount} />
              </div>
            </div>

            {/* User Account Section */}
            <div className="border-t border-gray-200 pt-3 mt-3">
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="checkbox"
                  id="createUserAccount"
                  checked={createUserAccount}
                  onChange={(e) => {
                    setCreateUserAccount(e.target.checked);
                    if (!e.target.checked) {
                      setPassword('');
                      setIsManager(false);
                    }
                  }}
                  className="w-3.5 h-3.5 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <label htmlFor="createUserAccount" className="text-xs font-medium text-gray-700">
                  Create login account for this doctor
                </label>
              </div>

              {createUserAccount && (
                <div className="space-y-3 ml-5 pl-3 border-l-2 border-primary-100">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">Password *</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-primary-500"
                      placeholder="Min 6 characters"
                      minLength={6}
                      required
                    />
                    <p className="text-[10px] text-gray-400 mt-0.5">Doctor will use email and this password to login</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isManager"
                      checked={isManager}
                      onChange={(e) => setIsManager(e.target.checked)}
                      className="w-3.5 h-3.5 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                    />
                    <label htmlFor="isManager" className="text-xs text-gray-700">
                      Also make this doctor a <span className="font-medium text-purple-700">Hospital Manager</span>
                    </label>
                  </div>
                  {isManager && (
                    <p className="text-[10px] text-purple-600 bg-purple-50 p-2 rounded">
                      Manager access: Can manage doctors, staff, licenses, and all clinic settings
                    </p>
                  )}
                  {!isManager && (
                    <p className="text-[10px] text-blue-600 bg-blue-50 p-2 rounded">
                      Doctor access: Can view their appointments, queue, patients, and analytics (when licensed)
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-gray-200">
            <button type="button" onClick={onBack} className="px-3 py-1.5 text-xs text-gray-700 hover:text-gray-900">Cancel</button>
            <button type="submit" disabled={mutation.isPending || !firstName.trim() || !lastName.trim() || !specialization} className="px-3 py-1.5 bg-primary-600 text-white rounded text-xs font-medium disabled:opacity-50">
              {mutation.isPending ? 'Creating...' : 'Create & Set Schedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Edit Doctor View - Compact
function EditDoctorView({
  doctorId,
  doctor,
  licenseInfo,
  clinicTime,
  onBack,
}: {
  doctorId: string;
  doctor?: ManagerDoctor;
  licenseInfo?: ManagerLicenseInfo | null;
  clinicTime?: { currentDate: string; timezone: string } | null;
  onBack: () => void;
}) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'details' | 'schedule'>('details');

  // Use firstName/lastName directly from API
  const [firstName, setFirstName] = useState(doctor?.firstName || '');
  const [lastName, setLastName] = useState(doctor?.lastName || '');
  const [specialization, setSpecialization] = useState(doctor?.specialization || '');
  const [phone, setPhone] = useState(doctor?.phone || '');
  const [email, setEmail] = useState(doctor?.email || '');
  const [appointmentDurationMin, setAppointmentDurationMin] = useState(doctor?.appointmentDurationMin || 10);
  const [error, setError] = useState('');
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // User account state
  const [showCreateAccount, setShowCreateAccount] = useState(false);
  const [accountPassword, setAccountPassword] = useState('');
  const [isManager, setIsManager] = useState(doctor?.clinicRole === 'CLINIC_MANAGER');

  const { data: specializations } = useQuery({
    queryKey: ['specializations'],
    queryFn: async () => {
      const { data, error } = await getSpecializations();
      if (error) throw new Error(error.message);
      return data || [];
    },
  });

  const [shiftTemplates, setShiftTemplates] = useState<Record<ShiftType, { start: string; end: string }>>({
    MORNING: { start: '09:00', end: '13:00' },
    EVENING: { start: '14:00', end: '18:00' },
  });
  const [weeklyShifts, setWeeklyShifts] = useState<Record<number, Record<ShiftType, boolean>>>({});

  const [showTimeOffModal, setShowTimeOffModal] = useState(false);
  const [timeOffForm, setTimeOffForm] = useState({ startDate: '', endDate: '', type: 'BREAK' as TimeOffType, reason: '' });
  const [calendarDate, setCalendarDate] = useState(new Date());

  // Conflict checking state
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [conflictingAppointments, setConflictingAppointments] = useState<ConflictingAppointment[]>([]);
  const [pendingSchedulePayload, setPendingSchedulePayload] = useState<UpdateSchedulePayload | null>(null);
  const [isCheckingConflicts, setIsCheckingConflicts] = useState(false);

  const { data: scheduleData, isLoading: scheduleLoading } = useQuery({
    queryKey: ['doctorSchedule', doctorId],
    queryFn: async () => {
      const { data, error } = await getDoctorScheduleData(doctorId);
      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!doctorId,
  });

  useEffect(() => {
    if (doctor) {
      setFirstName(doctor.firstName || '');
      setLastName(doctor.lastName || '');
      setSpecialization(doctor.specialization);
      setPhone(doctor.phone || '');
      setEmail(doctor.email || '');
      setAppointmentDurationMin(doctor.appointmentDurationMin);
      setIsManager(doctor.clinicRole === 'CLINIC_MANAGER');
    }
  }, [doctor]);

  useEffect(() => {
    if (scheduleData) {
      setAppointmentDurationMin(scheduleData.doctor.appointmentDurationMin);
      const templates: Record<ShiftType, { start: string; end: string }> = {
        MORNING: scheduleData.shiftTemplate.MORNING || { start: '09:00', end: '13:00' },
        EVENING: scheduleData.shiftTemplate.EVENING || { start: '14:00', end: '18:00' },
      };
      setShiftTemplates(templates);

      const weekly: Record<number, Record<ShiftType, boolean>> = {};
      for (let day = 0; day <= 6; day++) {
        const dayData = scheduleData.weekly.find((w) => w.dayOfWeek === day);
        weekly[day] = dayData?.shifts || { MORNING: false, EVENING: false };
      }
      setWeeklyShifts(weekly);
    }
  }, [scheduleData]);

  // Detect unsaved schedule changes that will affect slots
  const hasScheduleChanges = useMemo(() => {
    if (!scheduleData) return false;

    // Check duration change
    const originalDuration = scheduleData.doctor.appointmentDurationMin;
    if (appointmentDurationMin !== originalDuration) return true;

    // Check shift template changes
    const originalTemplates = scheduleData.shiftTemplate;
    for (const shift of ['MORNING', 'EVENING'] as const) {
      const orig = originalTemplates[shift];
      const curr = shiftTemplates[shift];
      if (orig?.start !== curr?.start || orig?.end !== curr?.end) return true;
    }

    // Check weekly shift changes
    for (let day = 0; day <= 6; day++) {
      const dayData = scheduleData.weekly.find((w) => w.dayOfWeek === day);
      const original = dayData?.shifts || { MORNING: false, EVENING: false };
      const current = weeklyShifts[day] || { MORNING: false, EVENING: false };
      for (const shift of ['MORNING', 'EVENING'] as const) {
        if (!!original[shift] !== !!current[shift]) return true;
      }
    }

    return false;
  }, [scheduleData, appointmentDurationMin, shiftTemplates, weeklyShifts]);

  const handleUpdateDoctor = () => {
    setError('');
    if (!firstName.trim()) { setError('First name required'); return; }
    if (!lastName.trim()) { setError('Last name required'); return; }
    if (!specialization) { setError('Specialization required'); return; }
    if (phone && !isValidPhone(phone)) { setError('Phone must be 10 digits'); return; }
    if (email.trim() && !isValidEmail(email.trim())) { setError('Invalid email'); return; }
    // Validate password if creating account
    if (showCreateAccount && !doctor?.hasUserAccount) {
      if (!accountPassword || accountPassword.length < 6) {
        setError('Password must be at least 6 characters');
        return;
      }
      if (!email.trim()) {
        setError('Email is required to create a login account');
        return;
      }
    }
    updateMutation.mutate();
  };

  const updateMutation = useMutation({
    mutationFn: async () => {
      const updateData: any = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        specialization,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
      };

      // Include user account creation if requested
      if (showCreateAccount && !doctor?.hasUserAccount && accountPassword) {
        updateData.createUserAccount = true;
        updateData.password = accountPassword;
        updateData.isManager = isManager;
      }

      // Include role update if changed for existing account
      if (doctor?.hasUserAccount && isManager !== (doctor.clinicRole === 'CLINIC_MANAGER')) {
        updateData.isManager = isManager;
      }

      const { error } = await managerUpdateDoctor(doctorId, updateData);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manager'] });
      setSaveMessage({ type: 'success', text: 'Saved!' });
      setTimeout(() => setSaveMessage(null), 2000);
      // Reset account creation state
      setShowCreateAccount(false);
      setAccountPassword('');
    },
    onError: (err: Error) => setError(err.message),
  });

  const scheduleMutation = useMutation({
    mutationFn: async (payload: UpdateSchedulePayload) => {
      const { error } = await updateDoctorSchedule(doctorId, payload);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctorSchedule', doctorId] });
      setSaveMessage({ type: 'success', text: 'Schedule saved!' });
      setTimeout(() => setSaveMessage(null), 2000);
    },
    onError: (err: Error) => setSaveMessage({ type: 'error', text: err.message }),
  });

  // Mutation to update schedule and cancel conflicting appointments
  const scheduleWithConflictsMutation = useMutation({
    mutationFn: async (payload: UpdateSchedulePayload & { cancelConflictingAppointments: boolean }) => {
      const { data, error } = await updateScheduleWithConflicts(doctorId, payload);
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['doctorSchedule', doctorId] });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      const cancelledCount = data?.cancelledAppointments?.length || 0;
      setSaveMessage({
        type: 'success',
        text: cancelledCount > 0
          ? `Schedule saved! ${cancelledCount} appointment(s) cancelled.`
          : 'Schedule saved!',
      });
      setTimeout(() => setSaveMessage(null), 3000);
      setShowConflictModal(false);
      setPendingSchedulePayload(null);
      setConflictingAppointments([]);
    },
    onError: (err: Error) => setSaveMessage({ type: 'error', text: err.message }),
  });

  const assignMutation = useMutation({
    mutationFn: async () => {
      const { error } = await managerAssignLicense(doctorId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['manager'] }),
  });

  const revokeMutation = useMutation({
    mutationFn: async () => {
      const { error } = await managerRevokeLicense(doctorId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['manager'] }),
  });

  const createTimeOffMutation = useMutation({
    mutationFn: async () => {
      const { error } = await createTimeOff(doctorId, { startDate: timeOffForm.startDate, endDate: timeOffForm.endDate, type: timeOffForm.type, reason: timeOffForm.reason || undefined });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setShowTimeOffModal(false);
      setTimeOffForm({ startDate: '', endDate: '', type: 'BREAK', reason: '' });
      queryClient.invalidateQueries({ queryKey: ['doctorSchedule', doctorId] });
    },
  });

  const deleteTimeOffMutation = useMutation({
    mutationFn: async (timeOffId: string) => {
      const { error } = await deleteTimeOff(doctorId, timeOffId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      // Use refetchQueries to force immediate refresh (invalidateQueries won't refetch with staleTime > 0)
      queryClient.refetchQueries({ queryKey: ['doctorSchedule', doctorId] });
    },
  });

  const handleSaveSchedule = async () => {
    const payload: UpdateSchedulePayload = {
      appointmentDurationMin,
      shiftTemplate: shiftTemplates,
      weekly: Object.entries(weeklyShifts).map(([day, shifts]) => ({ dayOfWeek: parseInt(day), shifts })),
    };

    // First check for conflicts
    setIsCheckingConflicts(true);
    try {
      const { data: conflicts, error } = await checkScheduleConflicts(doctorId, payload);
      if (error) {
        setSaveMessage({ type: 'error', text: error.message });
        return;
      }

      if (conflicts?.hasConflicts && conflicts.conflictingAppointments.length > 0) {
        // Show conflict modal
        setConflictingAppointments(conflicts.conflictingAppointments);
        setPendingSchedulePayload(payload);
        setShowConflictModal(true);
      } else {
        // No conflicts, save directly
        scheduleMutation.mutate(payload);
      }
    } catch (err) {
      setSaveMessage({ type: 'error', text: 'Failed to check for conflicts' });
    } finally {
      setIsCheckingConflicts(false);
    }
  };

  const handleConfirmScheduleWithConflicts = () => {
    if (pendingSchedulePayload) {
      scheduleWithConflictsMutation.mutate({
        ...pendingSchedulePayload,
        cancelConflictingAppointments: true,
      });
    }
  };

  const handleCancelConflictModal = () => {
    setShowConflictModal(false);
    setPendingSchedulePayload(null);
    setConflictingAppointments([]);
  };

  const handleShiftTemplateChange = (shift: ShiftType, field: 'start' | 'end', value: string) => {
    setShiftTemplates((prev) => ({ ...prev, [shift]: { ...prev[shift], [field]: value } }));
  };

  const handleWeeklyShiftToggle = (day: number, shift: ShiftType) => {
    setWeeklyShifts((prev) => ({ ...prev, [day]: { ...prev[day], [shift]: !prev[day]?.[shift] } }));
  };

  const calendarDays = useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const startingDayOfWeek = firstDay.getDay();
    const lastDay = new Date(year, month + 1, 0);
    const totalDays = lastDay.getDate();
    const days: (Date | null)[] = [];
    for (let i = 0; i < startingDayOfWeek; i++) days.push(null);
    for (let day = 1; day <= totalDays; day++) days.push(new Date(year, month, day));
    return days;
  }, [calendarDate]);

  const isTimeOffDay = (date: Date | null): boolean => {
    if (!date || !scheduleData?.timeOff) return false;
    // Format as YYYY-MM-DD in local timezone (not UTC) to avoid date shift
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    return scheduleData.timeOff.some((t) => dateStr >= t.startDate && dateStr <= t.endDate);
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header - Compact */}
      <div className="bg-white rounded border border-gray-200 p-2 mb-2">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="p-1 rounded hover:bg-gray-100">
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-semibold text-primary-700">{doctor?.fullName?.charAt(0) || '?'}</span>
          </div>
          <div className="flex-1">
            <h1 className="text-sm font-semibold text-gray-900">{doctor?.fullName || 'Doctor'}</h1>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="px-1.5 py-0.5 bg-teal-50 text-teal-700 text-[10px] font-medium rounded">{doctor?.specialization}</span>
              {doctor?.hasLicense ? (
                <span className="px-1.5 py-0.5 bg-green-50 text-green-700 text-[10px] font-medium rounded">Licensed</span>
              ) : (
                <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-medium rounded">No License</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {doctor?.hasLicense ? (
              <button onClick={() => { if (confirm('Revoke license?')) revokeMutation.mutate(); }} disabled={revokeMutation.isPending} className="px-2 py-1 text-[10px] text-orange-600 border border-orange-300 rounded hover:bg-orange-50">
                Revoke
              </button>
            ) : (
              <button onClick={() => assignMutation.mutate()} disabled={assignMutation.isPending || (licenseInfo?.available || 0) <= 0} className="px-2 py-1 text-[10px] bg-primary-600 text-white rounded disabled:opacity-50">
                Assign License
              </button>
            )}
          </div>
        </div>
      </div>

      {saveMessage && (
        <div className={`mb-2 px-2 py-1.5 rounded text-xs ${saveMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {saveMessage.text}
        </div>
      )}

      {/* Tabs - Compact */}
      <div className="bg-white rounded border border-gray-200 mb-2">
        <div className="flex border-b border-gray-200">
          {(['details', 'schedule'] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`px-3 py-1.5 text-xs font-medium border-b-2 -mb-px flex items-center gap-1 ${activeTab === tab ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500'}`}>
              {tab === 'details' ? 'Details' : 'Schedule'}
              {tab === 'schedule' && hasScheduleChanges && (
                <span className="w-2 h-2 bg-amber-500 rounded-full" title="Unsaved changes"></span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Details Tab - Compact */}
      {activeTab === 'details' && (
        <div className="bg-white rounded border border-gray-200 p-3">
          <form onSubmit={(e) => { e.preventDefault(); handleUpdateDoctor(); }}>
            <div className="space-y-3">
              {error && <div className="bg-red-50 border border-red-200 rounded p-2 text-xs text-red-700">{error}</div>}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">First Name *</label>
                  <input type="text" required value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">Last Name *</label>
                  <input type="text" required value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Specialization *</label>
                {specializations && specializations.length > 0 ? (
                  <select required value={specialization} onChange={(e) => setSpecialization(e.target.value)} className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded">
                    <option value="">Select...</option>
                    {specializations.map((spec) => (<option key={spec.id} value={spec.value}>{spec.value}</option>))}
                  </select>
                ) : (
                  <input type="text" required value={specialization} onChange={(e) => setSpecialization(e.target.value)} className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded" />
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">Phone</label>
                  <PhoneInput value={phone} onChange={(fullPhone) => setPhone(fullPhone)} placeholder="10-digit" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">Email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded" />
                </div>
              </div>

              {/* User Account Section */}
              <div className="border-t border-gray-200 pt-3 mt-3">
                <h3 className="text-xs font-semibold text-gray-900 mb-2">Login Account</h3>
                {doctor?.hasUserAccount ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded">
                      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div className="flex-1">
                        <p className="text-xs text-green-700 font-medium">Login account active</p>
                        <p className="text-[10px] text-green-600">{doctor.email} can log in to the app</p>
                      </div>
                    </div>

                    {/* Role Toggle */}
                    <div className="flex items-center gap-2 p-2 bg-gray-50 border border-gray-200 rounded">
                      <input
                        type="checkbox"
                        id="isManagerToggle"
                        checked={isManager}
                        onChange={(e) => setIsManager(e.target.checked)}
                        className="w-3.5 h-3.5 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                      />
                      <label htmlFor="isManagerToggle" className="flex-1">
                        <span className="text-xs font-medium text-gray-700">Hospital Manager Role</span>
                        <p className="text-[10px] text-gray-500">
                          {isManager ? 'Can manage doctors, staff, licenses, and all clinic settings' : 'Doctor access only - appointments, queue, patients, analytics'}
                        </p>
                      </label>
                    </div>
                    {isManager !== (doctor.clinicRole === 'CLINIC_MANAGER') && (
                      <p className="text-[10px] text-amber-600 bg-amber-50 p-1.5 rounded">
                        Role change will be saved when you click Save
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {!showCreateAccount ? (
                      <div className="flex items-center justify-between p-2 bg-gray-50 border border-gray-200 rounded">
                        <div>
                          <p className="text-xs text-gray-600">No login account</p>
                          <p className="text-[10px] text-gray-400">This doctor cannot log in to the app</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowCreateAccount(true)}
                          className="px-2 py-1 text-[10px] bg-primary-600 text-white rounded hover:bg-primary-700"
                        >
                          Create Account
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2 p-2 bg-blue-50 border border-blue-200 rounded">
                        <p className="text-xs font-medium text-blue-700">Create Login Account</p>
                        <div>
                          <label className="block text-[10px] text-gray-600 mb-0.5">Password *</label>
                          <input
                            type="password"
                            value={accountPassword}
                            onChange={(e) => setAccountPassword(e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                            placeholder="Min 6 characters"
                            minLength={6}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="newAccountIsManager"
                            checked={isManager}
                            onChange={(e) => setIsManager(e.target.checked)}
                            className="w-3.5 h-3.5 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                          />
                          <label htmlFor="newAccountIsManager" className="text-xs text-gray-700">
                            Also make this doctor a <span className="font-medium text-purple-700">Hospital Manager</span>
                          </label>
                        </div>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => { setShowCreateAccount(false); setAccountPassword(''); }}
                            className="px-2 py-1 text-[10px] text-gray-600 hover:bg-gray-100 rounded"
                          >
                            Cancel
                          </button>
                        </div>
                        <p className="text-[10px] text-blue-600">
                          Account will be created when you click Save
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4 pt-2 border-t border-gray-200">
              <button type="button" onClick={onBack} className="px-3 py-1.5 text-xs text-gray-700">Back</button>
              <button type="submit" disabled={updateMutation.isPending} className="px-3 py-1.5 bg-primary-600 text-white rounded text-xs font-medium disabled:opacity-50">
                {updateMutation.isPending ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Schedule Tab - Compact */}
      {activeTab === 'schedule' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          <div className="md:col-span-1 lg:col-span-2 space-y-2">
            {scheduleLoading ? (
              <div className="bg-white rounded border p-4 text-center text-xs text-gray-500">Loading...</div>
            ) : (
              <>
                {/* Shift Timings - Compact */}
                <div className="bg-white rounded border border-gray-200 p-2">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-xs font-semibold text-gray-900">Shift Timings</h2>
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] text-gray-600">Consultation Duration:</label>
                      <select
                        value={appointmentDurationMin}
                        onChange={(e) => setAppointmentDurationMin(parseInt(e.target.value))}
                        className="px-2 py-1 text-xs border border-gray-300 rounded bg-white"
                      >
                        {DURATION_OPTIONS.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {SHIFT_TYPES.map((shift) => (
                      <div key={shift} className="bg-gray-50 rounded p-2 border border-gray-200">
                        <div className="flex items-center gap-1 mb-2">
                          <span className="text-sm">{SHIFT_ICONS[shift]}</span>
                          <span className="text-xs font-medium text-gray-900">{SHIFT_LABELS[shift]}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-1">
                          <select value={shiftTemplates[shift].start} onChange={(e) => handleShiftTemplateChange(shift, 'start', e.target.value)} className="px-1 py-1 text-[10px] border border-gray-300 rounded">
                            {TIME_OPTIONS.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                          </select>
                          <select value={shiftTemplates[shift].end} onChange={(e) => handleShiftTemplateChange(shift, 'end', e.target.value)} className="px-1 py-1 text-[10px] border border-gray-300 rounded">
                            {TIME_OPTIONS.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                  {hasScheduleChanges && doctor?.hasLicense && (
                    <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded">
                      <div className="flex items-start gap-2">
                        <span className="text-amber-600 text-sm">⚠️</span>
                        <div className="text-[10px] text-amber-700">
                          <p className="font-medium">Schedule changes detected</p>
                          <p className="text-amber-600 mt-0.5">Saving will regenerate slots. Existing booked appointments that conflict will need to be cancelled.</p>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="flex justify-end pt-2 mt-2 border-t border-gray-200">
                    <button
                      onClick={handleSaveSchedule}
                      disabled={scheduleMutation.isPending || isCheckingConflicts}
                      className={`px-2 py-1 text-white rounded text-xs font-medium disabled:opacity-50 ${hasScheduleChanges && doctor?.hasLicense ? 'bg-amber-600 hover:bg-amber-700' : 'bg-primary-600 hover:bg-primary-700'}`}
                    >
                      {isCheckingConflicts ? 'Checking conflicts...' : scheduleMutation.isPending ? 'Saving...' : hasScheduleChanges && doctor?.hasLicense ? 'Check & Save Schedule' : 'Save Schedule'}
                    </button>
                  </div>
                </div>

                {/* Weekly Schedule - Compact with Times */}
                <div className="bg-white rounded border border-gray-200 p-2">
                  <h2 className="text-xs font-semibold text-gray-900 mb-2">Weekly Schedule</h2>
                  <div className="space-y-1">
                    {DAY_NAMES.map((dayName, dayIndex) => {
                      const dayShifts = weeklyShifts[dayIndex] || { MORNING: false, EVENING: false };
                      const hasAnyShift = dayShifts.MORNING || dayShifts.EVENING;
                      const enabledShifts = SHIFT_TYPES.filter(s => dayShifts[s]);
                      return (
                        <div key={dayIndex} className={`flex items-center gap-2 p-1.5 rounded border ${hasAnyShift ? 'bg-green-50/50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                          <div className="w-10 text-xs font-medium text-gray-900">{dayName}</div>
                          <div className="flex-1 flex flex-wrap gap-1">
                            {SHIFT_TYPES.map((shift) => (
                              <button
                                key={shift}
                                onClick={() => handleWeeklyShiftToggle(dayIndex, shift)}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-medium flex items-center gap-1 ${
                                  dayShifts[shift]
                                    ? 'bg-primary-100 text-primary-700 border border-primary-200'
                                    : 'bg-gray-100 text-gray-400 border border-gray-200 hover:bg-gray-200'
                                }`}
                                title={`${SHIFT_LABELS[shift]}: ${formatTime(shiftTemplates[shift].start)} - ${formatTime(shiftTemplates[shift].end)}`}
                              >
                                <span>{SHIFT_ICONS[shift]}</span>
                                {dayShifts[shift] && (
                                  <span className="text-[9px]">
                                    {formatTime(shiftTemplates[shift].start).replace(' ', '')}-{formatTime(shiftTemplates[shift].end).replace(' ', '')}
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                          {!hasAnyShift && <span className="text-[10px] text-gray-400">Off</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Right Column - Compact */}
          <div className="space-y-2">
            {/* Calendar - Compact */}
            <div className="bg-white rounded border border-gray-200 p-2">
              <div className="flex items-center justify-between mb-2">
                <button onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1))} className="p-0.5 rounded hover:bg-gray-100">
                  <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <div className="text-xs font-medium text-gray-900">{calendarDate.toLocaleString('default', { month: 'short', year: 'numeric' })}</div>
                <button onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1))} className="p-0.5 rounded hover:bg-gray-100">
                  <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>
              <div className="grid grid-cols-7 gap-0.5 mb-1">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                  <div key={i} className="text-center text-[10px] font-medium text-gray-500">{day}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-0.5">
                {calendarDays.map((date, index) => {
                  const isOff = isTimeOffDay(date);
                  // Use clinic timezone for "today" highlight, not browser local time
                  const dateStr = date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` : '';
                  const isToday = dateStr === clinicTime?.currentDate;
                  return (
                    <div key={index} className={`aspect-square flex items-center justify-center text-[10px] rounded ${!date ? '' : isOff ? 'bg-red-100 text-red-700 font-medium' : isToday ? 'bg-primary-100 text-primary-700 font-medium' : 'text-gray-700'}`}>
                      {date?.getDate()}
                    </div>
                  );
                })}
              </div>
              <button onClick={() => setShowTimeOffModal(true)} className="w-full mt-2 px-2 py-1 text-[10px] text-gray-700 border border-gray-300 rounded hover:bg-gray-50">
                + Add Time Off
              </button>
            </div>

            {/* Time Off List - Compact */}
            <div className="bg-white rounded border border-gray-200 p-2">
              <h3 className="text-xs font-semibold text-gray-900 mb-2">Time Off</h3>
              {!scheduleData?.timeOff?.length ? (
                <p className="text-[10px] text-gray-500 text-center py-2">No time off scheduled</p>
              ) : (
                <div className="space-y-1 max-h-24 overflow-y-auto">
                  {scheduleData.timeOff.map((entry) => (
                    <div key={entry.id} className="flex items-center gap-1 p-1 bg-gray-50 rounded text-[10px]">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">
                          {entry.startDate === entry.endDate
                            ? formatDateLocal(entry.startDate, { month: 'short', day: 'numeric' })
                            : `${formatDateLocal(entry.startDate, { month: 'short', day: 'numeric' })} - ${formatDateLocal(entry.endDate, { month: 'short', day: 'numeric' })}`}
                        </div>
                      </div>
                      <button onClick={() => { if (confirm('Remove?')) deleteTimeOffMutation.mutate(entry.id); }} className="p-0.5 text-gray-400 hover:text-red-500">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Time Off Modal - Compact */}
      {showTimeOffModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-xs mx-4">
            <div className="p-3 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900">Add Time Off</h3>
            </div>
            <div className="p-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-700 mb-0.5">Start</label>
                  <input type="date" value={timeOffForm.startDate} onChange={(e) => setTimeOffForm({ ...timeOffForm, startDate: e.target.value })} className="w-full px-2 py-1 text-xs border border-gray-300 rounded" />
                </div>
                <div>
                  <label className="block text-xs text-gray-700 mb-0.5">End</label>
                  <input type="date" value={timeOffForm.endDate} onChange={(e) => setTimeOffForm({ ...timeOffForm, endDate: e.target.value })} className="w-full px-2 py-1 text-xs border border-gray-300 rounded" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-700 mb-0.5">Type</label>
                <select value={timeOffForm.type} onChange={(e) => setTimeOffForm({ ...timeOffForm, type: e.target.value as TimeOffType })} className="w-full px-2 py-1 text-xs border border-gray-300 rounded">
                  <option value="BREAK">Break</option>
                  <option value="VACATION">Vacation</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
            </div>
            <div className="p-3 border-t border-gray-200 flex justify-end gap-2">
              <button onClick={() => setShowTimeOffModal(false)} className="px-2 py-1 text-xs text-gray-700">Cancel</button>
              <button onClick={() => createTimeOffMutation.mutate()} disabled={!timeOffForm.startDate || !timeOffForm.endDate || createTimeOffMutation.isPending} className="px-2 py-1 bg-primary-600 text-white rounded text-xs font-medium disabled:opacity-50">
                {createTimeOffMutation.isPending ? 'Adding...' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Conflict Modal */}
      {showConflictModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="p-3 border-b border-gray-200 bg-amber-50">
              <h3 className="text-sm font-semibold text-amber-800 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Schedule Conflict Detected
              </h3>
            </div>
            <div className="p-3">
              <p className="text-xs text-gray-700 mb-3">
                The schedule changes will conflict with <strong>{conflictingAppointments.length}</strong> existing appointment(s).
                These appointments will be <strong>cancelled</strong> if you proceed.
              </p>
              <div className="max-h-48 overflow-y-auto space-y-2">
                {conflictingAppointments.map((appt) => {
                  const startDate = new Date(appt.startsAt);
                  const reasonLabels: Record<string, string> = {
                    DURATION_MISMATCH: 'Time no longer valid',
                    SHIFT_DISABLED: 'Shift disabled',
                    TIME_OUTSIDE_SHIFT: 'Outside shift hours',
                  };
                  return (
                    <div key={appt.id} className="bg-gray-50 rounded border border-gray-200 p-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-xs font-medium text-gray-900">{appt.patientName}</p>
                          <p className="text-[10px] text-gray-500">{appt.patientPhone}</p>
                        </div>
                        <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">
                          {reasonLabels[appt.reason] || appt.reason}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-600 mt-1">
                        {startDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at{' '}
                        {startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="p-3 border-t border-gray-200 flex justify-end gap-2">
              <button
                onClick={handleCancelConflictModal}
                className="px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmScheduleWithConflicts}
                disabled={scheduleWithConflictsMutation.isPending}
                className="px-3 py-1.5 bg-amber-600 text-white rounded text-xs font-medium disabled:opacity-50 hover:bg-amber-700"
              >
                {scheduleWithConflictsMutation.isPending ? 'Saving...' : `Cancel ${conflictingAppointments.length} Appointment(s) & Save`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Staff Tab - Compact with Doctor Assignments
function StaffTab({ staff, loading, onAddStaff }: { staff: ManagerStaff[]; loading: boolean; onAddStaff: () => void }) {
  const queryClient = useQueryClient();
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);

  const removeMutation = useMutation({
    mutationFn: async (staffId: string) => {
      const { error } = await managerRemoveStaff(staffId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['manager', 'staff'] }),
  });

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'CLINIC_MANAGER': return 'bg-purple-100 text-purple-700';
      case 'CLINIC_DOCTOR': return 'bg-blue-100 text-blue-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <p className="text-[10px] text-gray-600">{staff.filter(s => s.isActive).length} active</p>
        <button onClick={onAddStaff} className="px-2 py-1 bg-primary-600 text-white rounded text-xs font-medium">+ Add Staff</button>
      </div>

      {loading ? (
        <div className="text-gray-500 py-4 text-center text-xs">Loading...</div>
      ) : staff.length === 0 ? (
        <div className="bg-white rounded border border-gray-200 text-center py-6">
          <p className="text-xs text-gray-500 mb-2">No staff members yet.</p>
          <button onClick={onAddStaff} className="px-2 py-1 bg-primary-600 text-white rounded text-xs font-medium">Add First Staff</button>
        </div>
      ) : (
        <div className="bg-white rounded border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase">Member</th>
                <th className="px-2 py-1.5 text-center text-[10px] font-medium text-gray-500 uppercase">Role</th>
                <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase">Assigned Doctors</th>
                <th className="px-2 py-1.5 text-center text-[10px] font-medium text-gray-500 uppercase">Status</th>
                <th className="px-2 py-1.5 text-right text-[10px] font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {staff.map((member) => (
                <tr key={member.id} className="hover:bg-gray-50">
                  <td className="px-2 py-1.5">
                    <p className="text-xs font-medium text-gray-900">{member.user.firstName} {member.user.lastName || ''}</p>
                    <p className="text-[10px] text-gray-500">{member.user.email}</p>
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded-full ${getRoleBadgeColor(member.role)}`}>
                      {member.role.replace('CLINIC_', '')}
                    </span>
                  </td>
                  <td className="px-2 py-1.5">
                    {member.role === 'CLINIC_STAFF' ? (
                      <div className="flex items-center gap-1 flex-wrap">
                        {member.assignedDoctors && member.assignedDoctors.length > 0 ? (
                          <>
                            {member.assignedDoctors.slice(0, 3).map((doc) => (
                              <span key={doc.id} className="px-1.5 py-0.5 text-[10px] bg-blue-50 text-blue-700 rounded">
                                {doc.fullName.split(' ')[0]}
                              </span>
                            ))}
                            {member.assignedDoctors.length > 3 && (
                              <span className="text-[10px] text-gray-500">+{member.assignedDoctors.length - 3}</span>
                            )}
                          </>
                        ) : (
                          <span className="text-[10px] text-gray-400">None assigned</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-[10px] text-gray-400">All (by role)</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded-full ${member.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {member.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {member.role === 'CLINIC_STAFF' && member.isActive && (
                        <button
                          onClick={() => setEditingStaffId(member.id)}
                          className="text-primary-600 hover:text-primary-800 text-[10px] font-medium"
                        >
                          Edit Doctors
                        </button>
                      )}
                      {member.isActive && member.role !== 'CLINIC_MANAGER' && (
                        <button onClick={() => { if (confirm(`Remove?`)) removeMutation.mutate(member.id); }} disabled={removeMutation.isPending} className="text-red-600 hover:text-red-800 text-[10px]">
                          Remove
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editingStaffId && (
        <StaffDoctorAssignmentModal
          staffId={editingStaffId}
          staffMember={staff.find(s => s.id === editingStaffId)}
          onClose={() => setEditingStaffId(null)}
        />
      )}
    </div>
  );
}

// Staff Doctor Assignment Modal
function StaffDoctorAssignmentModal({
  staffId,
  staffMember,
  onClose,
}: {
  staffId: string;
  staffMember?: ManagerStaff;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [selectedDoctorIds, setSelectedDoctorIds] = useState<string[]>(
    staffMember?.assignedDoctors?.map(d => d.id) || []
  );
  const [error, setError] = useState('');

  // Fetch all licensed doctors
  const { data: licensedDoctors, isLoading } = useQuery({
    queryKey: ['manager', 'licensed-doctors'],
    queryFn: async () => {
      const { data, error } = await managerGetLicensedDoctors();
      if (error) throw new Error(error.message);
      return data || [];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await managerUpdateStaffDoctors(staffId, selectedDoctorIds);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manager', 'staff'] });
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  const toggleDoctor = (doctorId: string) => {
    setSelectedDoctorIds(prev =>
      prev.includes(doctorId)
        ? prev.filter(id => id !== doctorId)
        : [...prev, doctorId]
    );
  };

  const selectAll = () => {
    if (licensedDoctors) {
      setSelectedDoctorIds(licensedDoctors.map(d => d.id));
    }
  };

  const selectNone = () => {
    setSelectedDoctorIds([]);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[80vh] flex flex-col">
        <div className="px-4 py-2.5 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-sm font-semibold text-gray-900">
            Assign Doctors to {staffMember?.user.firstName} {staffMember?.user.lastName}
          </h2>
          <p className="text-[10px] text-gray-500 mt-0.5">
            Staff can only view/manage appointments for assigned doctors
          </p>
        </div>

        <div className="px-4 py-3 flex-1 overflow-y-auto">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-2 text-xs text-red-700 mb-3">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-600">
              {selectedDoctorIds.length} of {licensedDoctors?.length || 0} selected
            </span>
            <div className="flex gap-2">
              <button onClick={selectAll} className="text-[10px] text-primary-600 hover:underline">
                Select All
              </button>
              <button onClick={selectNone} className="text-[10px] text-gray-500 hover:underline">
                Clear
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="text-gray-500 py-4 text-center text-xs">Loading doctors...</div>
          ) : licensedDoctors && licensedDoctors.length > 0 ? (
            <div className="space-y-1">
              {licensedDoctors.map((doctor) => (
                <label
                  key={doctor.id}
                  className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors ${
                    selectedDoctorIds.includes(doctor.id)
                      ? 'bg-primary-50 border-primary-200'
                      : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedDoctorIds.includes(doctor.id)}
                    onChange={() => toggleDoctor(doctor.id)}
                    className="w-3.5 h-3.5 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <div className="flex-1">
                    <p className="text-xs font-medium text-gray-900">{doctor.fullName}</p>
                  </div>
                </label>
              ))}
            </div>
          ) : (
            <div className="text-gray-500 py-4 text-center text-xs">
              No licensed doctors available
            </div>
          )}
        </div>

        <div className="px-4 py-2.5 border-t border-gray-200 flex justify-end gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 rounded"
          >
            Cancel
          </button>
          <button
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending}
            className="px-3 py-1.5 bg-primary-600 text-white rounded text-xs font-medium disabled:opacity-50"
          >
            {updateMutation.isPending ? 'Saving...' : 'Save Assignments'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Licenses Tab - Compact
function LicensesTab({ licenseInfo, stats }: { licenseInfo?: ManagerLicenseInfo | null; stats?: ManagerClinicStats | null }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white rounded border border-gray-200 p-2 text-center">
          <p className="text-lg font-bold text-gray-900">{licenseInfo?.total || 0}</p>
          <p className="text-[10px] text-gray-500">Total</p>
        </div>
        <div className="bg-white rounded border border-gray-200 p-2 text-center">
          <p className="text-lg font-bold text-blue-600">{licenseInfo?.used || 0}</p>
          <p className="text-[10px] text-gray-500">Used</p>
        </div>
        <div className="bg-white rounded border border-gray-200 p-2 text-center">
          <p className="text-lg font-bold text-green-600">{licenseInfo?.available || 0}</p>
          <p className="text-[10px] text-gray-500">Available</p>
        </div>
      </div>

      <div className="bg-white rounded border border-gray-200 p-3">
        <h3 className="text-xs font-semibold text-gray-900 mb-2">Usage</h3>
        <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
          <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${licenseInfo && licenseInfo.total > 0 ? (licenseInfo.used / licenseInfo.total) * 100 : 0}%` }} />
        </div>
        <p className="text-[10px] text-gray-600">{licenseInfo?.used || 0} of {licenseInfo?.total || 0} ({licenseInfo && licenseInfo.total > 0 ? Math.round((licenseInfo.used / licenseInfo.total) * 100) : 0}%)</p>
      </div>

      {stats && (
        <div className="bg-white rounded border border-gray-200 p-3">
          <h3 className="text-xs font-semibold text-gray-900 mb-2">Stats</h3>
          <div className="grid grid-cols-4 gap-2 text-center">
            <div>
              <p className="text-sm font-semibold text-gray-900">{stats.counts.doctors}</p>
              <p className="text-[10px] text-gray-500">Doctors</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-green-600">{stats.counts.activeDoctors}</p>
              <p className="text-[10px] text-gray-500">Active</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-blue-600">{stats.counts.licensedDoctors}</p>
              <p className="text-[10px] text-gray-500">Licensed</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">{stats.counts.staff}</p>
              <p className="text-[10px] text-gray-500">Staff</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-gray-50 rounded border border-gray-200 p-2">
        <p className="text-[10px] text-gray-600">Need more licenses? Contact your ClinIQ administrator.</p>
      </div>
    </div>
  );
}

// Add Staff Modal - Compact
function AddStaffModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'CLINIC_STAFF' | 'CLINIC_DOCTOR'>('CLINIC_STAFF');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    setError('');
    if (!firstName.trim()) { setError('First name required'); return; }
    if (!lastName.trim()) { setError('Last name required'); return; }
    if (!email.trim()) { setError('Email required'); return; }
    if (!isValidEmail(email.trim())) { setError('Invalid email'); return; }
    if (!password || password.length < 6) { setError('Password min 6 chars'); return; }
    if (phone && !isValidPhone(phone)) { setError('Phone must be 10 digits'); return; }
    mutation.mutate();
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await managerAddStaff({ firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(), password, phone: phone.trim() || undefined, role });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['manager', 'staff'] }); onClose(); },
    onError: (err: Error) => setError(err.message),
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-sm w-full">
        <div className="px-4 py-2.5 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">Add Staff Member</h2>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
          <div className="px-4 py-3 space-y-3">
            {error && <div className="bg-red-50 border border-red-200 rounded p-2 text-xs text-red-700">{error}</div>}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">First Name *</label>
                <input type="text" required value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Last Name *</label>
                <input type="text" required value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">Email *</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded" placeholder="staff@example.com" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">Password *</label>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded" minLength={6} />
              <p className="text-[10px] text-gray-400 mt-0.5">Min 6 characters</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">Phone</label>
              <PhoneInput value={phone} onChange={(fullPhone) => setPhone(fullPhone)} placeholder="10-digit" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">Role *</label>
              <select value={role} onChange={(e) => setRole(e.target.value as 'CLINIC_STAFF' | 'CLINIC_DOCTOR')} className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded">
                <option value="CLINIC_STAFF">Staff</option>
                <option value="CLINIC_DOCTOR">Doctor</option>
              </select>
            </div>
          </div>
          <div className="px-4 py-2.5 border-t border-gray-200 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs text-gray-700">Cancel</button>
            <button type="submit" disabled={mutation.isPending || !email.trim() || !firstName.trim() || !lastName.trim() || !password} className="px-3 py-1.5 bg-primary-600 text-white rounded text-xs font-medium disabled:opacity-50">
              {mutation.isPending ? 'Adding...' : 'Add Staff'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
