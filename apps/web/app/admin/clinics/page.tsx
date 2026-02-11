'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  adminListClinics,
  adminCreateClinic,
  adminDeleteClinic,
  adminGetCountries,
  AdminClinic,
  CreateClinicData,
  CountryConfigMap,
} from '../../../lib/api';

export default function AdminClinicsPage() {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { data: clinics, isLoading, error } = useQuery({
    queryKey: ['admin', 'clinics'],
    queryFn: async () => {
      const { data, error } = await adminListClinics();
      if (error) throw new Error(error.message);
      return data;
    },
  });

  const { data: countries } = useQuery({
    queryKey: ['admin', 'countries'],
    queryFn: async () => {
      const { data, error } = await adminGetCountries();
      if (error) throw new Error(error.message);
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await adminDeleteClinic(id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'clinics'] });
    },
  });

  const handleDeactivate = (clinic: AdminClinic) => {
    if (confirm(`Are you sure you want to deactivate "${clinic.name}"?`)) {
      deleteMutation.mutate(clinic.id);
    }
  };

  const formatLocation = (clinic: AdminClinic) => {
    const parts = [clinic.city, clinic.state, clinic.country].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : 'No location';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - Compact */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Hospital Management</h1>
              <p className="text-xs text-gray-500">Manage hospitals and clinics</p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700"
            >
              + Add Hospital
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded p-2 text-red-700 text-xs">
            Failed to load clinics: {error.message}
          </div>
        )}

        {clinics && clinics.length === 0 && (
          <div className="text-center py-8">
            <div className="text-gray-400 mb-2">
              <svg className="w-10 h-10 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h3 className="text-sm font-medium text-gray-900 mb-1">No hospitals yet</h3>
            <p className="text-xs text-gray-500 mb-3">Get started by adding your first hospital.</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700"
            >
              + Add Hospital
            </button>
          </div>
        )}

        {clinics && clinics.length > 0 && (
          <div className="bg-white rounded border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                    Hospital
                  </th>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                    Phone
                  </th>
                  <th className="px-3 py-2 text-center text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                    Doctors
                  </th>
                  <th className="px-3 py-2 text-center text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                    Patients
                  </th>
                  <th className="px-3 py-2 text-center text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-3 py-2 text-right text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {clinics.map((clinic) => (
                  <tr key={clinic.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        {clinic.logoUrl ? (
                          <img
                            src={clinic.logoUrl}
                            alt={clinic.name}
                            className="w-7 h-7 rounded object-cover"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded bg-blue-100 flex items-center justify-center">
                            <span className="text-blue-600 font-semibold text-xs">
                              {clinic.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div>
                          <div className="text-xs font-medium text-gray-900">{clinic.name}</div>
                          <div className="text-[10px] text-gray-500">{clinic.timezone}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="text-xs text-gray-900">{formatLocation(clinic)}</div>
                      <div className="text-[10px] text-gray-500">{clinic.countryCode}</div>
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-xs text-gray-900">
                        {clinic.phone ? `${clinic.phonePrefix} ${clinic.phone}` : '-'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className="text-xs font-semibold text-gray-900">{clinic.stats.doctors}</span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className="text-xs text-gray-900">{clinic.stats.patients}</span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span
                        className={`inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded-full ${
                          clinic.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {clinic.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/admin/clinics/${clinic.id}`}
                          className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                        >
                          View
                        </Link>
                        {clinic.isActive && (
                          <button
                            onClick={() => handleDeactivate(clinic)}
                            className="text-red-600 hover:text-red-800 text-xs font-medium"
                            disabled={deleteMutation.isPending}
                          >
                            Deactivate
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
      </main>

      {/* Create Modal */}
      {showCreateModal && countries && (
        <CreateClinicModal
          countries={countries}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            queryClient.invalidateQueries({ queryKey: ['admin', 'clinics'] });
          }}
        />
      )}
    </div>
  );
}

function CreateClinicModal({
  countries,
  onClose,
  onSuccess,
}: {
  countries: CountryConfigMap;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState<CreateClinicData>({
    name: '',
    phone: '',
    countryCode: 'US',
    timezone: 'America/Chicago',
    street: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'United States',
    logoUrl: '',
    pictureUrl: '',
    authMode: 'PASSWORD',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const config = countries[formData.countryCode || 'US'];
    if (config) {
      setFormData((prev) => ({
        ...prev,
        timezone: config.timezone,
        country: config.name,
      }));
    }
  }, [formData.countryCode, countries]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error } = await adminCreateClinic(formData);
      if (error) {
        setError(error.message);
      } else {
        onSuccess();
      }
    } catch (err) {
      setError('Failed to create hospital');
    } finally {
      setLoading(false);
    }
  };

  const countryEntries = Object.entries(countries);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-4 py-2.5 border-b border-gray-200 sticky top-0 bg-white">
          <h2 className="text-sm font-semibold text-gray-900">Add New Hospital</h2>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="px-4 py-3 space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded p-2 text-xs text-red-700">
                {error}
              </div>
            )}

            {/* Basic Info */}
            <div className="space-y-3">
              <h3 className="text-xs font-medium text-gray-900 border-b pb-1">Basic Information</h3>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">
                  Hospital Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="e.g., City General Hospital"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">
                    Country *
                  </label>
                  <select
                    value={formData.countryCode}
                    onChange={(e) => setFormData({ ...formData, countryCode: e.target.value })}
                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {countryEntries.map(([code, config]) => (
                      <option key={code} value={code}>
                        {config.name} ({config.phonePrefix})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">
                    Phone
                  </label>
                  <div className="flex">
                    <span className="inline-flex items-center px-2 rounded-l border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-xs">
                      {countries[formData.countryCode || 'US']?.phonePrefix || '+1'}
                    </span>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded-r focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="555-123-4567"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Address */}
            <div className="space-y-3">
              <h3 className="text-xs font-medium text-gray-900 border-b pb-1">Address</h3>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">
                  Street Address
                </label>
                <input
                  type="text"
                  value={formData.street}
                  onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="123 Medical Center Drive"
                />
              </div>

              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">
                    City
                  </label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Chicago"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">
                    State
                  </label>
                  <input
                    type="text"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="IL"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">
                    Postal
                  </label>
                  <input
                    type="text"
                    value={formData.postalCode}
                    onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="60601"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">
                    Timezone
                  </label>
                  <select
                    value={formData.timezone}
                    onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="America/New_York">ET</option>
                    <option value="America/Chicago">CT</option>
                    <option value="America/Denver">MT</option>
                    <option value="America/Los_Angeles">PT</option>
                    <option value="Asia/Kolkata">IST</option>
                    <option value="Asia/Tokyo">JST</option>
                    <option value="Asia/Singapore">SGT</option>
                    <option value="Asia/Dubai">GST</option>
                    <option value="Europe/London">GMT</option>
                    <option value="Europe/Berlin">CET</option>
                    <option value="Australia/Sydney">AET</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Branding & Settings */}
            <div className="space-y-3">
              <h3 className="text-xs font-medium text-gray-900 border-b pb-1">Branding & Settings</h3>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">
                    Logo URL
                  </label>
                  <input
                    type="url"
                    value={formData.logoUrl}
                    onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="https://..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">
                    Auth Mode
                  </label>
                  <select
                    value={formData.authMode}
                    onChange={(e) =>
                      setFormData({ ...formData, authMode: e.target.value as 'PASSWORD' | 'PHONE_OTP' })
                    }
                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="PASSWORD">Email + Password</option>
                    <option value="PHONE_OTP">Phone OTP</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="px-4 py-2.5 border-t border-gray-200 flex justify-end gap-2 sticky bottom-0 bg-white">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-gray-700 hover:text-gray-900 text-xs font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !formData.name}
              className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Hospital'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
