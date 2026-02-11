'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  adminGetClinic,
  adminUpdateClinic,
  adminGetCountries,
  adminPurchaseLicenses,
  adminCreateManager,
  adminUpdateStaff,
  adminGetClinicSlotStatus,
  adminBulkGenerateSlots,
  adminGenerateDoctorSlots,
  adminClearDoctorSlots,
  UpdateClinicData,
  PurchaseLicensesData,
  CreateManagerData,
  UpdateStaffData,
  AdminDoctor,
  AdminClinicSlotStatus,
  AdminDoctorSlotStatus,
} from '../../../../lib/api';

export default function AdminClinicDetailPage() {
  const params = useParams();
  const queryClient = useQueryClient();
  const clinicId = params.id as string;

  const [activeTab, setActiveTab] = useState<'info' | 'doctors' | 'staff' | 'licenses' | 'slots'>('info');
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<UpdateClinicData>({});
  const [saveError, setSaveError] = useState('');
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showAddManagerModal, setShowAddManagerModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<any | null>(null);

  const { data: clinic, isLoading, error } = useQuery({
    queryKey: ['admin', 'clinics', clinicId],
    queryFn: async () => {
      const { data, error } = await adminGetClinic(clinicId);
      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!clinicId,
  });

  const { data: countries } = useQuery({
    queryKey: ['admin', 'countries'],
    queryFn: async () => {
      const { data, error } = await adminGetCountries();
      if (error) throw new Error(error.message);
      return data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: UpdateClinicData) => {
      const { error } = await adminUpdateClinic(clinicId, data);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'clinics', clinicId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'clinics'] });
      setIsEditing(false);
      setSaveError('');
    },
    onError: (error: Error) => {
      setSaveError(error.message);
    },
  });

  const startEditing = () => {
    if (clinic) {
      setFormData({
        name: clinic.name,
        phone: clinic.phone || '',
        countryCode: clinic.countryCode,
        timezone: clinic.timezone,
        street: clinic.street || '',
        city: clinic.city || '',
        state: clinic.state || '',
        postalCode: clinic.postalCode || '',
        country: clinic.country || '',
        logoUrl: clinic.logoUrl || '',
        pictureUrl: clinic.pictureUrl || '',
        authMode: clinic.authMode,
        isActive: clinic.isActive,
      });
      setIsEditing(true);
    }
  };

  useEffect(() => {
    if (isEditing && countries && formData.countryCode) {
      const config = countries[formData.countryCode];
      if (config && formData.countryCode !== clinic?.countryCode) {
        setFormData((prev) => ({
          ...prev,
          timezone: config.timezone,
          country: config.name,
        }));
      }
    }
  }, [formData.countryCode, countries, isEditing, clinic?.countryCode]);

  const handleSave = () => {
    updateMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !clinic) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="bg-red-50 border border-red-200 rounded p-2 text-red-700 text-xs">
          {error?.message || 'Clinic not found'}
        </div>
        <Link href="/admin/clinics" className="text-blue-600 hover:underline mt-2 block text-xs">
          Back to Hospitals
        </Link>
      </div>
    );
  }

  const countryEntries = countries ? Object.entries(countries) : [];
  const phonePrefix = countries?.[clinic.countryCode]?.phonePrefix || clinic.phonePrefix;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - Compact */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/admin/clinics" className="text-gray-500 hover:text-gray-700">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </Link>
              <div className="flex items-center gap-2">
                {clinic.logoUrl ? (
                  <img src={clinic.logoUrl} alt={clinic.name} className="w-8 h-8 rounded object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded bg-blue-100 flex items-center justify-center">
                    <span className="text-blue-600 font-semibold text-sm">{clinic.name.charAt(0).toUpperCase()}</span>
                  </div>
                )}
                <div>
                  <h1 className="text-sm font-semibold text-gray-900">{clinic.name}</h1>
                  <p className="text-[10px] text-gray-500">
                    {clinic.licensesUsed}/{clinic.licensesTotal} licenses
                  </p>
                </div>
              </div>
            </div>
            {activeTab === 'info' && (
              <div className="flex items-center gap-2">
                {!isEditing ? (
                  <button onClick={startEditing} className="px-2.5 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700">
                    Edit
                  </button>
                ) : (
                  <>
                    <button onClick={() => setIsEditing(false)} className="px-2.5 py-1 text-gray-700 hover:text-gray-900 text-xs font-medium">
                      Cancel
                    </button>
                    <button onClick={handleSave} disabled={updateMutation.isPending} className="px-2.5 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 disabled:opacity-50">
                      {updateMutation.isPending ? 'Saving...' : 'Save'}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="mt-2 flex gap-2 border-t pt-2">
            {(['info', 'doctors', 'staff', 'licenses', 'slots'] as const).map((tab) => {
              const isActive = activeTab === tab;
              const tabConfig = {
                info: { icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z', label: 'Info', color: 'blue' },
                doctors: { icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z', label: `Doctors`, count: clinic.doctors.length, color: 'blue' },
                staff: { icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z', label: 'Staff', count: clinic.clinicUsers.length, color: 'purple' },
                licenses: { icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z', label: 'Licenses', count: clinic.licensesAvailable, color: 'green' },
                slots: { icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', label: 'Slots', color: 'orange' },
              }[tab];
              return (
                <button
                  key={tab}
                  onClick={() => { setActiveTab(tab); setIsEditing(false); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-sm'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tabConfig.icon} />
                  </svg>
                  {tabConfig.label}
                  {tabConfig.count !== undefined && (
                    <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full ${
                      isActive ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'
                    }`}>
                      {tabConfig.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        {saveError && (
          <div className="bg-red-50 border border-red-200 rounded p-2 text-red-700 text-xs mb-3">{saveError}</div>
        )}

        {activeTab === 'info' && (
          <InfoTab
            clinic={clinic}
            isEditing={isEditing}
            formData={formData}
            setFormData={setFormData}
            countries={countries}
            countryEntries={countryEntries}
            phonePrefix={phonePrefix}
          />
        )}

        {activeTab === 'doctors' && <DoctorsTab clinic={clinic} />}

        {activeTab === 'staff' && (
          <StaffTab clinic={clinic} onAddManager={() => setShowAddManagerModal(true)} onEditStaff={setEditingStaff} />
        )}

        {activeTab === 'licenses' && (
          <LicensesTab clinic={clinic} onPurchase={() => setShowPurchaseModal(true)} />
        )}

        {activeTab === 'slots' && <SlotsTab clinicId={clinicId} />}
      </main>

      {/* Modals */}
      {showPurchaseModal && (
        <PurchaseLicensesModal clinicId={clinicId} onClose={() => setShowPurchaseModal(false)} />
      )}

      {showAddManagerModal && (
        <AddManagerModal clinicId={clinicId} onClose={() => setShowAddManagerModal(false)} />
      )}

      {editingStaff && (
        <EditStaffModal
          clinicId={clinicId}
          staff={editingStaff}
          onClose={() => setEditingStaff(null)}
        />
      )}
    </div>
  );
}

// Info Tab Component - Compact
function InfoTab({ clinic, isEditing, formData, setFormData, countries, countryEntries, phonePrefix }: any) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
      <div className="lg:col-span-3 space-y-3">
        {/* Basic Info */}
        <div className="bg-white rounded border border-gray-200 p-3">
          <h2 className="text-xs font-semibold text-gray-900 mb-2">Basic Information</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="col-span-2">
              <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Name</label>
              {isEditing ? (
                <input type="text" value={formData.name || ''} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-2 py-1 text-xs border border-gray-300 rounded" />
              ) : (
                <p className="text-xs text-gray-900">{clinic.name}</p>
              )}
            </div>
            <div>
              <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Country</label>
              {isEditing ? (
                <select value={formData.countryCode || ''} onChange={(e) => setFormData({ ...formData, countryCode: e.target.value })} className="w-full px-2 py-1 text-xs border border-gray-300 rounded">
                  {countryEntries.map(([code, config]: [string, any]) => (
                    <option key={code} value={code}>{config.name}</option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-gray-900">{clinic.country || clinic.countryCode}</p>
              )}
            </div>
            <div>
              <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Phone</label>
              {isEditing ? (
                <div className="flex">
                  <span className="inline-flex items-center px-1.5 rounded-l border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-[10px]">
                    {countries?.[formData.countryCode || 'US']?.phonePrefix || '+1'}
                  </span>
                  <input type="tel" value={formData.phone || ''} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded-r" />
                </div>
              ) : (
                <p className="text-xs text-gray-900">{clinic.phone ? `${phonePrefix} ${clinic.phone}` : '-'}</p>
              )}
            </div>
            <div>
              <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Timezone</label>
              {isEditing ? (
                <select value={formData.timezone || ''} onChange={(e) => setFormData({ ...formData, timezone: e.target.value })} className="w-full px-2 py-1 text-xs border border-gray-300 rounded">
                  <option value="America/New_York">ET</option>
                  <option value="America/Chicago">CT</option>
                  <option value="America/Denver">MT</option>
                  <option value="America/Los_Angeles">PT</option>
                  <option value="Asia/Kolkata">IST</option>
                  <option value="Europe/London">GMT</option>
                </select>
              ) : (
                <p className="text-xs text-gray-900">{clinic.timezone}</p>
              )}
            </div>
            <div>
              <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Status</label>
              {isEditing ? (
                <select value={formData.isActive ? 'active' : 'inactive'} onChange={(e) => setFormData({ ...formData, isActive: e.target.value === 'active' })} className="w-full px-2 py-1 text-xs border border-gray-300 rounded">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              ) : (
                <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded-full ${clinic.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {clinic.isActive ? 'Active' : 'Inactive'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Address */}
        <div className="bg-white rounded border border-gray-200 p-3">
          <h2 className="text-xs font-semibold text-gray-900 mb-2">Address</h2>
          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-2">
              <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Street</label>
              {isEditing ? (
                <input type="text" value={formData.street || ''} onChange={(e) => setFormData({ ...formData, street: e.target.value })} className="w-full px-2 py-1 text-xs border border-gray-300 rounded" />
              ) : (
                <p className="text-xs text-gray-900">{clinic.street || '-'}</p>
              )}
            </div>
            <div>
              <label className="block text-[10px] font-medium text-gray-500 mb-0.5">City</label>
              {isEditing ? (
                <input type="text" value={formData.city || ''} onChange={(e) => setFormData({ ...formData, city: e.target.value })} className="w-full px-2 py-1 text-xs border border-gray-300 rounded" />
              ) : (
                <p className="text-xs text-gray-900">{clinic.city || '-'}</p>
              )}
            </div>
            <div>
              <label className="block text-[10px] font-medium text-gray-500 mb-0.5">State</label>
              {isEditing ? (
                <input type="text" value={formData.state || ''} onChange={(e) => setFormData({ ...formData, state: e.target.value })} className="w-full px-2 py-1 text-xs border border-gray-300 rounded" />
              ) : (
                <p className="text-xs text-gray-900">{clinic.state || '-'}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar - Compact */}
      <div className="space-y-3">
        <div className="bg-white rounded border border-gray-200 p-3">
          <h2 className="text-xs font-semibold text-gray-900 mb-2">Statistics</h2>
          <div className="grid grid-cols-2 gap-2">
            <div className="text-center p-2 bg-gray-50 rounded">
              <div className="text-lg font-bold text-gray-900">{clinic.doctors.length}</div>
              <div className="text-[10px] text-gray-500">Doctors</div>
            </div>
            <div className="text-center p-2 bg-gray-50 rounded">
              <div className="text-lg font-bold text-green-600">{clinic.licensesUsed}</div>
              <div className="text-[10px] text-gray-500">Licensed</div>
            </div>
            <div className="text-center p-2 bg-gray-50 rounded">
              <div className="text-lg font-bold text-gray-900">{clinic.stats.patients}</div>
              <div className="text-[10px] text-gray-500">Patients</div>
            </div>
            <div className="text-center p-2 bg-gray-50 rounded">
              <div className="text-lg font-bold text-gray-900">{clinic.stats.appointments}</div>
              <div className="text-[10px] text-gray-500">Appts</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded border border-gray-200 p-3">
          <h2 className="text-xs font-semibold text-gray-900 mb-2">Licenses</h2>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500">Total</span>
              <span className="font-medium">{clinic.licensesTotal}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Used</span>
              <span className="font-medium text-blue-600">{clinic.licensesUsed}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Available</span>
              <span className="font-medium text-green-600">{clinic.licensesAvailable}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
              <div
                className="bg-blue-600 h-1.5 rounded-full"
                style={{ width: `${clinic.licensesTotal > 0 ? (clinic.licensesUsed / clinic.licensesTotal) * 100 : 0}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Doctors Tab Component - Enhanced
function DoctorsTab({ clinic }: { clinic: any }) {
  const activeCount = clinic.doctors.filter((d: AdminDoctor) => d.isActive).length;
  const licensedCount = clinic.doctors.filter((d: AdminDoctor) => d.hasLicense).length;

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-3 text-white shadow-sm">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-white/20 rounded-lg">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xl font-bold">{clinic.doctors.length}</p>
              <p className="text-[10px] text-blue-100">Total Doctors</p>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-3 text-white shadow-sm">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-white/20 rounded-lg">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xl font-bold">{activeCount}</p>
              <p className="text-[10px] text-green-100">Active</p>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-3 text-white shadow-sm">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-white/20 rounded-lg">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <p className="text-xl font-bold">{licensedCount}</p>
              <p className="text-[10px] text-purple-100">Licensed</p>
            </div>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-100 rounded-lg">
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Doctors List</h2>
            <p className="text-[10px] text-gray-500">Managed by Hospital Manager</p>
          </div>
        </div>
      </div>

      {clinic.doctors.length === 0 ? (
        <div className="bg-white rounded-lg border-2 border-dashed border-gray-200 p-8 text-center">
          <div className="w-12 h-12 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-900 mb-1">No doctors registered</p>
          <p className="text-xs text-gray-500">Doctors can be added by the Hospital Manager</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <table className="min-w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Doctor</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Contact</th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">License</th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {clinic.doctors.map((doctor: AdminDoctor) => (
                <tr key={doctor.id} className="hover:bg-blue-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {doctor.photoUrl ? (
                        <img src={doctor.photoUrl} alt={doctor.fullName} className="w-9 h-9 rounded-full object-cover ring-2 ring-gray-100" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center ring-2 ring-blue-100">
                          <span className="text-white text-sm font-semibold">{doctor.fullName.charAt(0)}</span>
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{doctor.fullName}</p>
                        <p className="text-xs text-blue-600">{doctor.specialization}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 text-xs text-gray-700">
                      <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      {doctor.email || '-'}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-0.5">
                      <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      {doctor.phone || '-'}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {doctor.hasLicense ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700 border border-green-200">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        Licensed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        None
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${
                      doctor.isActive
                        ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                        : 'bg-red-100 text-red-700 border border-red-200'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${doctor.isActive ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                      {doctor.isActive ? 'Active' : 'Inactive'}
                    </span>
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

// Staff Tab Component - Enhanced
function StaffTab({ clinic, onAddManager, onEditStaff }: { clinic: any; onAddManager: () => void; onEditStaff: (staff: any) => void }) {
  const managers = clinic.clinicUsers.filter((cu: any) => cu.role === 'CLINIC_MANAGER');
  const staff = clinic.clinicUsers.filter((cu: any) => cu.role === 'CLINIC_STAFF');
  const activeCount = clinic.clinicUsers.filter((cu: any) => cu.isActive).length;

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-3 text-white shadow-sm">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-white/20 rounded-lg">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xl font-bold">{clinic.clinicUsers.length}</p>
              <p className="text-[10px] text-purple-100">Total Staff</p>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg p-3 text-white shadow-sm">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-white/20 rounded-lg">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <p className="text-xl font-bold">{managers.length}</p>
              <p className="text-[10px] text-indigo-100">Managers</p>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-lg p-3 text-white shadow-sm">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-white/20 rounded-lg">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xl font-bold">{activeCount}</p>
              <p className="text-[10px] text-teal-100">Active</p>
            </div>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-purple-100 rounded-lg">
            <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Staff Members</h2>
            <p className="text-[10px] text-gray-500">{managers.length} manager{managers.length !== 1 ? 's' : ''}, {staff.length} staff</p>
          </div>
        </div>
        <button
          onClick={onAddManager}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg text-xs font-medium hover:from-purple-700 hover:to-purple-800 shadow-sm transition-all"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Add Manager
        </button>
      </div>

      {clinic.clinicUsers.length === 0 ? (
        <div className="bg-white rounded-lg border-2 border-dashed border-purple-200 p-8 text-center">
          <div className="w-12 h-12 mx-auto mb-3 bg-purple-100 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-900 mb-1">No staff members yet</p>
          <p className="text-xs text-gray-500 mb-3">Add managers to help run this hospital</p>
          <button
            onClick={onAddManager}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add First Manager
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <table className="min-w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">User</th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Role</th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {clinic.clinicUsers.map((cu: any) => (
                <tr key={cu.id} className="hover:bg-purple-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center ring-2 ${
                        cu.role === 'CLINIC_MANAGER'
                          ? 'bg-gradient-to-br from-indigo-400 to-indigo-600 ring-indigo-100'
                          : 'bg-gradient-to-br from-gray-400 to-gray-600 ring-gray-100'
                      }`}>
                        <span className="text-white text-sm font-semibold">
                          {cu.user.firstName?.charAt(0) || cu.user.email.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {cu.user.firstName} {cu.user.lastName || ''}
                        </p>
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                          <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          {cu.user.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full border ${
                      cu.role === 'CLINIC_MANAGER'
                        ? 'bg-indigo-100 text-indigo-700 border-indigo-200'
                        : 'bg-gray-100 text-gray-700 border-gray-200'
                    }`}>
                      {cu.role === 'CLINIC_MANAGER' && (
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                      )}
                      {cu.role.replace('CLINIC_', '')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${
                      cu.isActive
                        ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                        : 'bg-red-100 text-red-700 border border-red-200'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${cu.isActive ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                      {cu.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => onEditStaff(cu)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-purple-600 hover:text-purple-800 hover:bg-purple-100 rounded-lg transition-colors"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit
                    </button>
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

// Licenses Tab Component - Enhanced
function LicensesTab({ clinic, onPurchase }: { clinic: any; onPurchase: () => void }) {
  const usagePercent = clinic.licensesTotal > 0 ? (clinic.licensesUsed / clinic.licensesTotal) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* License Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gradient-to-br from-slate-600 to-slate-700 rounded-lg p-3 text-white shadow-sm">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-white/20 rounded-lg">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold">{clinic.licensesTotal}</p>
              <p className="text-[10px] text-slate-200">Total Licenses</p>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-3 text-white shadow-sm">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-white/20 rounded-lg">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold">{clinic.licensesUsed}</p>
              <p className="text-[10px] text-blue-100">Assigned</p>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg p-3 text-white shadow-sm">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-white/20 rounded-lg">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold">{clinic.licensesAvailable}</p>
              <p className="text-[10px] text-emerald-100">Available</p>
            </div>
          </div>
        </div>
      </div>

      {/* Usage Progress */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-100 rounded-lg">
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-gray-900">License Usage</span>
          </div>
          <span className="text-sm font-bold text-gray-700">{usagePercent.toFixed(0)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
          <div
            className={`h-2.5 rounded-full transition-all ${
              usagePercent >= 90 ? 'bg-red-500' : usagePercent >= 70 ? 'bg-yellow-500' : 'bg-emerald-500'
            }`}
            style={{ width: `${usagePercent}%` }}
          ></div>
        </div>
        <div className="flex justify-between mt-2 text-xs text-gray-500">
          <span>{clinic.licensesUsed} assigned to doctors</span>
          <span>{clinic.licensesAvailable} available</span>
        </div>
      </div>

      {/* Purchase History Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-green-100 rounded-lg">
            <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Purchase History</h2>
            <p className="text-[10px] text-gray-500">{clinic.licensePurchases.length} transaction{clinic.licensePurchases.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <button
          onClick={onPurchase}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-lg text-xs font-medium hover:from-emerald-700 hover:to-emerald-800 shadow-sm transition-all"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Purchase Licenses
        </button>
      </div>

      {/* Purchase History Table */}
      {clinic.licensePurchases.length === 0 ? (
        <div className="bg-white rounded-lg border-2 border-dashed border-green-200 p-8 text-center">
          <div className="w-12 h-12 mx-auto mb-3 bg-green-100 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-900 mb-1">No purchases yet</p>
          <p className="text-xs text-gray-500 mb-3">Purchase licenses to assign to doctors</p>
          <button
            onClick={onPurchase}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Purchase First Licenses
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <table className="min-w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Date</th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Quantity</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Price/License</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Total</th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Payment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {clinic.licensePurchases.map((purchase: any) => (
                <tr key={purchase.id} className="hover:bg-green-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1 bg-gray-100 rounded">
                        <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <span className="text-sm text-gray-900">
                        {new Date(purchase.purchasedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center px-2 py-1 text-sm font-bold text-emerald-700 bg-emerald-100 rounded-lg">
                      +{purchase.quantity}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-700">
                    {purchase.currency} {purchase.pricePerLicense.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-bold text-gray-900">
                      {purchase.currency} {purchase.totalAmount.toFixed(2)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700 border border-gray-200">
                      {purchase.paymentMethod === 'card' && (
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                        </svg>
                      )}
                      {purchase.paymentMethod === 'bank_transfer' && (
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
                        </svg>
                      )}
                      {purchase.paymentMethod || 'N/A'}
                    </span>
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

// Purchase Licenses Modal - Compact
function PurchaseLicensesModal({ clinicId, onClose }: { clinicId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<PurchaseLicensesData>({
    quantity: 1,
    pricePerLicense: 99,
    currency: 'USD',
    paymentMethod: 'card',
    paymentRef: '',
    notes: '',
  });
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await adminPurchaseLicenses(clinicId, formData);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'clinics', clinicId] });
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  const totalAmount = formData.quantity * formData.pricePerLicense;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-sm w-full">
        <div className="px-4 py-2.5 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">Purchase Licenses</h2>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>
          <div className="px-4 py-3 space-y-3">
            {error && <div className="bg-red-50 border border-red-200 rounded p-2 text-xs text-red-700">{error}</div>}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Quantity *</label>
                <input type="number" required value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })} className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded" min={1} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Price/License *</label>
                <input type="number" required value={formData.pricePerLicense} onChange={(e) => setFormData({ ...formData, pricePerLicense: parseFloat(e.target.value) || 0 })} className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded" min={0} step={0.01} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Currency</label>
                <select value={formData.currency} onChange={(e) => setFormData({ ...formData, currency: e.target.value })} className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded">
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                  <option value="INR">INR</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Method</label>
                <select value={formData.paymentMethod || ''} onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })} className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded">
                  <option value="card">Card</option>
                  <option value="bank_transfer">Bank</option>
                  <option value="check">Check</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">Payment Ref</label>
              <input type="text" value={formData.paymentRef || ''} onChange={(e) => setFormData({ ...formData, paymentRef: e.target.value })} className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded" placeholder="Transaction ID" />
            </div>
            <div className="bg-gray-50 rounded p-2 flex justify-between text-xs">
              <span className="text-gray-500">{formData.quantity} x {formData.currency} {formData.pricePerLicense}</span>
              <span className="font-semibold">{formData.currency} {totalAmount.toFixed(2)}</span>
            </div>
          </div>
          <div className="px-4 py-2.5 border-t border-gray-200 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-gray-700 text-xs font-medium">Cancel</button>
            <button type="submit" disabled={mutation.isPending || formData.quantity <= 0} className="px-3 py-1.5 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 disabled:opacity-50">
              {mutation.isPending ? 'Processing...' : 'Purchase'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Add Manager Modal - Compact
function AddManagerModal({ clinicId, onClose }: { clinicId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<CreateManagerData>({
    email: '',
    firstName: '',
    lastName: '',
    password: '',
    phone: '',
  });
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await adminCreateManager(clinicId, formData);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'clinics', clinicId] });
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-sm w-full">
        <div className="px-4 py-2.5 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">Add Hospital Manager</h2>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>
          <div className="px-4 py-3 space-y-3">
            {error && <div className="bg-red-50 border border-red-200 rounded p-2 text-xs text-red-700">{error}</div>}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">First Name *</label>
                <input type="text" required value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Last Name</label>
                <input type="text" value={formData.lastName || ''} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">Email *</label>
              <input type="email" required value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded" placeholder="manager@hospital.com" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">Password *</label>
              <input type="password" required value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded" minLength={6} />
              <p className="text-[10px] text-gray-400 mt-0.5">Min 6 characters</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">Phone</label>
              <input type="tel" value={formData.phone || ''} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded" />
            </div>
          </div>
          <div className="px-4 py-2.5 border-t border-gray-200 bg-gray-50 rounded-b-lg">
            <p className="text-[10px] text-gray-500 mb-2">Manager can add doctors, assign licenses, and manage staff.</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="px-3 py-1.5 text-gray-700 text-xs font-medium">Cancel</button>
              <button type="submit" disabled={mutation.isPending || !formData.email || !formData.firstName || !formData.password} className="px-3 py-1.5 bg-purple-600 text-white rounded text-xs font-medium hover:bg-purple-700 disabled:opacity-50">
                {mutation.isPending ? 'Creating...' : 'Create Manager'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// Edit Staff Modal - Compact
function EditStaffModal({ clinicId, staff, onClose }: { clinicId: string; staff: any; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<UpdateStaffData>({
    role: staff.role,
    isActive: staff.isActive,
  });
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await adminUpdateStaff(clinicId, staff.id, formData);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'clinics', clinicId] });
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-sm w-full">
        <div className="px-4 py-2.5 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">Edit Staff Member</h2>
          <p className="text-[10px] text-gray-500">{staff.user.firstName} {staff.user.lastName || staff.user.email}</p>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>
          <div className="px-4 py-3 space-y-3">
            {error && <div className="bg-red-50 border border-red-200 rounded p-2 text-xs text-red-700">{error}</div>}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">Role</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded"
              >
                <option value="CLINIC_MANAGER">Manager</option>
                <option value="CLINIC_STAFF">Staff</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">Status</label>
              <select
                value={formData.isActive ? 'active' : 'inactive'}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.value === 'active' })}
                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          <div className="px-4 py-2.5 border-t border-gray-200 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-gray-700 text-xs font-medium">Cancel</button>
            <button type="submit" disabled={mutation.isPending} className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 disabled:opacity-50">
              {mutation.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Slots Tab Component - For managing appointment slots
function SlotsTab({ clinicId }: { clinicId: string }) {
  const queryClient = useQueryClient();
  const [generatingAll, setGeneratingAll] = useState(false);
  const [generatingDoctor, setGeneratingDoctor] = useState<string | null>(null);
  const [clearingDoctor, setClearingDoctor] = useState<string | null>(null);
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Date range modal state
  const [showDateRangeModal, setShowDateRangeModal] = useState(false);
  const [selectedDoctorForGeneration, setSelectedDoctorForGeneration] = useState<{ id: string; name: string } | null>(null);

  // Default dates: today to end of current quarter or 3 months
  const today = new Date();
  const defaultEndDate = new Date(today);
  defaultEndDate.setMonth(defaultEndDate.getMonth() + 3);
  const formatDate = (d: Date) => d.toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(formatDate(today));
  const [endDate, setEndDate] = useState(formatDate(defaultEndDate));

  const { data: slotStatus, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'clinics', clinicId, 'slots'],
    queryFn: async () => {
      const { data, error } = await adminGetClinicSlotStatus(clinicId);
      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!clinicId,
  });

  const handleBulkGenerate = async () => {
    setGeneratingAll(true);
    setResult(null);
    try {
      const { data, error } = await adminBulkGenerateSlots(clinicId);
      if (error) throw new Error(error.message);
      setResult({
        type: 'success',
        message: `Generated ${data?.totalSlotsCreated.toLocaleString()} slots for ${data?.processedCount} doctors${data?.errorCount ? ` (${data.errorCount} errors)` : ''}`,
      });
      refetch();
      queryClient.invalidateQueries({ queryKey: ['admin', 'clinics', clinicId] });
    } catch (e: any) {
      setResult({ type: 'error', message: e.message || 'Failed to generate slots' });
    } finally {
      setGeneratingAll(false);
    }
  };

  // Open the date range modal for a specific doctor
  const openDateRangeModal = (doctorId: string, doctorName: string) => {
    setSelectedDoctorForGeneration({ id: doctorId, name: doctorName });
    // Reset dates to defaults
    const today = new Date();
    const defaultEnd = new Date(today);
    defaultEnd.setMonth(defaultEnd.getMonth() + 3);
    setStartDate(formatDate(today));
    setEndDate(formatDate(defaultEnd));
    setShowDateRangeModal(true);
  };

  const handleGenerateForDoctor = async () => {
    if (!selectedDoctorForGeneration) return;

    setGeneratingDoctor(selectedDoctorForGeneration.id);
    setShowDateRangeModal(false);
    setResult(null);
    try {
      const { data, error } = await adminGenerateDoctorSlots(
        clinicId,
        selectedDoctorForGeneration.id,
        startDate,
        endDate,
      );
      if (error) throw new Error(error.message);
      setResult({
        type: 'success',
        message: `Generated ${data?.slotsCreated.toLocaleString()} slots for ${data?.doctorName} (${data?.startDate} to ${data?.endDate})`,
      });
      refetch();
    } catch (e: any) {
      setResult({ type: 'error', message: e.message || 'Failed to generate slots' });
    } finally {
      setGeneratingDoctor(null);
      setSelectedDoctorForGeneration(null);
    }
  };

  const handleClearForDoctor = async (doctorId: string) => {
    if (!confirm('Are you sure you want to clear all future available slots for this doctor? Booked slots will not be affected.')) {
      return;
    }
    setClearingDoctor(doctorId);
    setResult(null);
    try {
      const { data, error } = await adminClearDoctorSlots(clinicId, doctorId);
      if (error) throw new Error(error.message);
      setResult({
        type: 'success',
        message: `Cleared ${data?.deletedCount.toLocaleString()} available slots`,
      });
      refetch();
    } catch (e: any) {
      setResult({ type: 'error', message: e.message || 'Failed to clear slots' });
    } finally {
      setClearingDoctor(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  if (error || !slotStatus) {
    return (
      <div className="bg-red-50 border border-red-200 rounded p-3 text-red-700 text-xs">
        {error?.message || 'Failed to load slot status'}
      </div>
    );
  }

  const configuredDoctors = slotStatus.doctors.filter((d: AdminDoctorSlotStatus) => d.scheduleConfiguredAt);
  const doctorsWithSlots = slotStatus.doctors.filter((d: AdminDoctorSlotStatus) => d.slotCount > 0);

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg p-3 text-white shadow-sm">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-white/20 rounded-lg">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xl font-bold">{slotStatus.totalDoctors}</p>
              <p className="text-[10px] text-orange-100">Total Doctors</p>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-3 text-white shadow-sm">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-white/20 rounded-lg">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xl font-bold">{configuredDoctors.length}</p>
              <p className="text-[10px] text-blue-100">Configured</p>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-3 text-white shadow-sm">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-white/20 rounded-lg">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-xl font-bold">{slotStatus.totalSlots.toLocaleString()}</p>
              <p className="text-[10px] text-green-100">Total Slots</p>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-3 text-white shadow-sm">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-white/20 rounded-lg">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-xl font-bold">{doctorsWithSlots.length}</p>
              <p className="text-[10px] text-purple-100">With Slots</p>
            </div>
          </div>
        </div>
      </div>

      {/* Result Message */}
      {result && (
        <div className={`p-3 rounded-lg text-xs ${
          result.type === 'success'
            ? 'bg-green-50 border border-green-200 text-green-700'
            : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          {result.message}
        </div>
      )}

      {/* Header with Bulk Generate Button */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-orange-100 rounded-lg">
            <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Appointment Slots</h2>
            <p className="text-[10px] text-gray-500">Manage slots for all doctors in this hospital</p>
          </div>
        </div>
        <button
          onClick={handleBulkGenerate}
          disabled={generatingAll || configuredDoctors.length === 0}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-orange-600 to-orange-700 text-white rounded-lg text-xs font-medium hover:from-orange-700 hover:to-orange-800 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generatingAll ? (
            <>
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
              Generating...
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Generate All Slots
            </>
          )}
        </button>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <svg className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-xs text-blue-700">
            <p className="font-medium mb-1">About Slot Generation</p>
            <ul className="list-disc list-inside space-y-0.5 text-blue-600">
              <li>Click "Generate" on each doctor to create slots for a specific date range</li>
              <li>When schedule changes (duration, shift times, weekly), slots are auto-regenerated within the stored range</li>
              <li>Use "Generate All Slots" at the beginning of each year for all doctors</li>
              <li>Only configured doctors with licenses will have slots generated</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Doctors List */}
      {slotStatus.doctors.length === 0 ? (
        <div className="bg-white rounded-lg border-2 border-dashed border-orange-200 p-8 text-center">
          <div className="w-12 h-12 mx-auto mb-3 bg-orange-100 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-900 mb-1">No doctors found</p>
          <p className="text-xs text-gray-500">Add doctors to this hospital to manage their slots</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <table className="min-w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Doctor</th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Total Slots</th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Available</th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Booked</th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Date Range</th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {slotStatus.doctors.map((doctor: AdminDoctorSlotStatus) => {
                const isConfigured = !!doctor.scheduleConfiguredAt;
                const hasSlots = doctor.slotCount > 0;
                return (
                  <tr key={doctor.doctorId} className="hover:bg-orange-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          doctor.isActive
                            ? 'bg-gradient-to-br from-orange-400 to-orange-600'
                            : 'bg-gray-300'
                        }`}>
                          <span className="text-white text-xs font-semibold">{doctor.doctorName.charAt(0)}</span>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{doctor.doctorName}</p>
                          <div className="flex items-center gap-1.5">
                            {doctor.hasLicense ? (
                              <span className="inline-flex items-center text-[10px] text-green-600">
                                <svg className="w-2.5 h-2.5 mr-0.5" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                                Licensed
                              </span>
                            ) : (
                              <span className="text-[10px] text-gray-400">No license</span>
                            )}
                            {!doctor.isActive && (
                              <span className="text-[10px] text-red-500">Inactive</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isConfigured ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700 border border-green-200">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          Configured
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm font-bold text-gray-900">{doctor.slotCount.toLocaleString()}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm font-medium text-green-600">{doctor.availableSlots.toLocaleString()}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm font-medium text-blue-600">{doctor.bookedSlots.toLocaleString()}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {doctor.slotsGeneratedFrom && doctor.slotsGeneratedTo ? (
                        <div className="text-[10px] text-gray-500">
                          <div>{new Date(doctor.slotsGeneratedFrom + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                          <div className="text-gray-400">to</div>
                          <div>{new Date(doctor.slotsGeneratedTo + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">Not generated</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => openDateRangeModal(doctor.doctorId, doctor.doctorName)}
                          disabled={!doctor.hasSchedule || generatingDoctor === doctor.doctorId}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-orange-600 hover:text-orange-800 hover:bg-orange-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title={!doctor.hasSchedule ? 'Schedule not configured' : 'Generate slots'}
                        >
                          {generatingDoctor === doctor.doctorId ? (
                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-orange-600"></div>
                          ) : (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          )}
                          Generate
                        </button>
                        <button
                          onClick={() => handleClearForDoctor(doctor.doctorId)}
                          disabled={!hasSlots || doctor.availableSlots === 0 || clearingDoctor === doctor.doctorId}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 hover:text-red-800 hover:bg-red-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title={!hasSlots ? 'No slots to clear' : 'Clear available slots'}
                        >
                          {clearingDoctor === doctor.doctorId ? (
                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-red-600"></div>
                          ) : (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
                          Clear
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Date Range Modal for Slot Generation */}
      {showDateRangeModal && selectedDoctorForGeneration && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-5 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Generate Slots</h3>
                    <p className="text-orange-100 text-xs">{selectedDoctorForGeneration.name}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowDateRangeModal(false)}
                  className="p-1 hover:bg-white/20 rounded transition-colors"
                >
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-600">
                Select the date range for generating appointment slots. Slots will be created based on the doctor's schedule configuration.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    min={formatDate(new Date())}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
              </div>

              {/* Quick presets */}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const d = new Date();
                    d.setMonth(d.getMonth() + 1);
                    setEndDate(formatDate(d));
                  }}
                  className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded text-gray-700 transition-colors"
                >
                  1 Month
                </button>
                <button
                  onClick={() => {
                    const d = new Date();
                    d.setMonth(d.getMonth() + 3);
                    setEndDate(formatDate(d));
                  }}
                  className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded text-gray-700 transition-colors"
                >
                  3 Months
                </button>
                <button
                  onClick={() => {
                    const d = new Date();
                    d.setMonth(d.getMonth() + 6);
                    setEndDate(formatDate(d));
                  }}
                  className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded text-gray-700 transition-colors"
                >
                  6 Months
                </button>
                <button
                  onClick={() => {
                    const d = new Date();
                    setEndDate(`${d.getFullYear()}-12-31`);
                  }}
                  className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded text-gray-700 transition-colors"
                >
                  End of Year
                </button>
              </div>

              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-xs text-orange-700">
                <p className="font-medium">Note:</p>
                <p>This will store the date range on the doctor record. When schedule changes occur, slots will automatically regenerate within this range.</p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowDateRangeModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateForDoctor}
                disabled={!startDate || !endDate || startDate > endDate}
                className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 rounded-lg shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Generate Slots
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
