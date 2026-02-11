'use client';

import { useState, useEffect } from 'react';
import type { Patient, Doctor, QueuePriority } from '../../lib/api';
import { searchPatients } from '../../lib/api';
import { useCreateWalkin } from '../../lib/hooks/useQueueData';
import PhoneInput, { isValidPhone, isValidEmail, formatPhoneDisplay } from '../PhoneInput';

type WalkInModalProps = {
  isOpen: boolean;
  onClose: () => void;
  doctor: Doctor | null;
  onSuccess: () => void;
};

export default function WalkInModal({
  isOpen,
  onClose,
  doctor,
  onSuccess,
}: WalkInModalProps) {
  const [mode, setMode] = useState<'search' | 'new'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [searching, setSearching] = useState(false);

  // New patient form - separate first/last name
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  // Priority selection
  const [priority, setPriority] = useState<QueuePriority>('NORMAL');

  // Reason for visit
  const [reason, setReason] = useState('');

  const [error, setError] = useState<string | null>(null);

  // Use optimistic mutation for walk-in creation
  const walkinMutation = useCreateWalkin(doctor?.id || null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setMode('search');
      setSearchQuery('');
      setSearchResults([]);
      setSelectedPatient(null);
      setFirstName('');
      setLastName('');
      setEmail('');
      setPhone('');
      setPriority('NORMAL');
      setReason('');
      setError(null);
    }
  }, [isOpen]);

  // Search patients
  useEffect(() => {
    if (mode !== 'search' || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      const { data } = await searchPatients(searchQuery);
      setSearchResults(data || []);
      setSearching(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, mode]);

  const handleAddWalkin = async () => {
    if (!doctor) return;

    setError(null);

    let patientName: string;
    let patientPhone: string;

    if (mode === 'new') {
      if (!firstName.trim()) {
        setError('First name is required');
        return;
      }
      if (!lastName.trim()) {
        setError('Last name is required');
        return;
      }
      if (!phone.trim() || !isValidPhone(phone)) {
        setError('Valid 10-digit phone number is required');
        return;
      }
      if (email.trim() && !isValidEmail(email.trim())) {
        setError('Please enter a valid email address');
        return;
      }
      patientName = `${firstName.trim()} ${lastName.trim()}`;
      patientPhone = phone.trim();
    } else {
      if (!selectedPatient) {
        setError('Please select a patient');
        return;
      }
      if (!selectedPatient.phone) {
        setError('Selected patient has no phone number');
        return;
      }
      patientName = selectedPatient.fullName;
      patientPhone = selectedPatient.phone;
    }

    // Use mutation with optimistic updates
    walkinMutation.mutate(
      {
        doctorId: doctor.id,
        patientName,
        patientPhone,
        priority,
        reason: reason.trim() || undefined,
      },
      {
        onSuccess: () => {
          onSuccess();
          onClose();
        },
        onError: (err) => {
          setError(err.message || 'Failed to add walk-in');
        },
      }
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-heading font-semibold text-gray-900">
            Add Walk-In
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Doctor info */}
          <div className="bg-gray-50 rounded-lg p-3 mb-4">
            <div className="text-xs text-gray-500">Doctor</div>
            <div className="text-sm font-medium text-gray-900">
              {doctor?.fullName || 'No doctor selected'}
            </div>
          </div>

          {/* Priority selection */}
          <div className="mb-4">
            <label className="field-label">Priority</label>
            <div className="flex gap-2">
              {(['NORMAL', 'URGENT', 'EMERGENCY'] as QueuePriority[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPriority(p)}
                  className={`flex-1 py-2 px-3 text-sm font-medium rounded-lg transition-colors ${
                    priority === p
                      ? p === 'EMERGENCY'
                        ? 'bg-red-100 text-red-700 border border-red-300'
                        : p === 'URGENT'
                          ? 'bg-orange-100 text-orange-700 border border-orange-300'
                          : 'bg-primary-100 text-primary-700 border border-primary-300'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-transparent'
                  }`}
                >
                  {p.charAt(0) + p.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Mode tabs */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setMode('search')}
              className={`flex-1 py-2 px-3 text-sm font-medium rounded-lg transition-colors ${
                mode === 'search'
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Existing Patient
            </button>
            <button
              onClick={() => setMode('new')}
              className={`flex-1 py-2 px-3 text-sm font-medium rounded-lg transition-colors ${
                mode === 'new'
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              New Patient
            </button>
          </div>

          {mode === 'search' ? (
            <>
              {/* Patient search */}
              <div className="mb-4">
                <label className="field-label">Search Patient</label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Name or phone..."
                  className="input-field"
                />
              </div>

              {/* Search results */}
              {searchQuery.length >= 2 && (
                <div className="mb-4 max-h-40 overflow-y-auto border border-gray-200 rounded-lg">
                  {searching ? (
                    <div className="p-3 text-sm text-gray-500 text-center">
                      Searching...
                    </div>
                  ) : searchResults.length === 0 ? (
                    <div className="p-3 text-sm text-gray-500 text-center">
                      No patients found
                    </div>
                  ) : (
                    searchResults.map((patient) => (
                      <button
                        key={patient.id}
                        onClick={() => setSelectedPatient(patient)}
                        className={`w-full text-left px-3 py-2 border-b border-gray-100 last:border-0 hover:bg-gray-50 ${
                          selectedPatient?.id === patient.id ? 'bg-primary-50' : ''
                        }`}
                      >
                        <div className="text-sm font-medium text-gray-900">
                          {patient.fullName}
                        </div>
                        {patient.phone && (
                          <div className="text-xs text-gray-500">{formatPhoneDisplay(patient.phone)}</div>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}

              {/* Selected patient */}
              {selectedPatient && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-green-800">
                        {selectedPatient.fullName}
                      </div>
                      {selectedPatient.phone && (
                        <div className="text-xs text-green-600">
                          {formatPhoneDisplay(selectedPatient.phone)}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => setSelectedPatient(null)}
                      className="text-green-600 hover:text-green-800"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {/* New patient form */}
              <div className="space-y-4">
                {/* First Name / Last Name in a row */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="field-label">First Name *</label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="First name"
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="field-label">Last Name *</label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Last name"
                      className="input-field"
                    />
                  </div>
                </div>

                {/* Phone */}
                <div>
                  <label className="field-label">Phone *</label>
                  <PhoneInput
                    value={phone}
                    onChange={(fullPhone) => setPhone(fullPhone)}
                    required
                    placeholder="10-digit number"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="field-label">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@example.com"
                    className={`input-field ${
                      email && !isValidEmail(email) ? 'border-red-300' : ''
                    }`}
                  />
                  {email && !isValidEmail(email) && (
                    <p className="mt-1 text-xs text-red-600">Please enter a valid email address</p>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Reason for visit */}
          <div className="mt-4">
            <label className="field-label">Reason for Visit</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="input-field"
            >
              <option value="">Select reason...</option>
              <option value="Consultation">Consultation</option>
              <option value="Follow-up">Follow-up</option>
              <option value="Fever">Fever</option>
              <option value="Cold & Cough">Cold & Cough</option>
              <option value="Body Pain">Body Pain</option>
              <option value="Headache">Headache</option>
              <option value="Stomach Issue">Stomach Issue</option>
              <option value="Skin Problem">Skin Problem</option>
              <option value="Injury">Injury</option>
              <option value="Lab Results">Lab Results</option>
              <option value="Prescription Refill">Prescription Refill</option>
              <option value="Vaccination">Vaccination</option>
              <option value="General Checkup">General Checkup</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {/* Error */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="btn-secondary flex-1"
            disabled={walkinMutation.isPending}
          >
            Cancel
          </button>
          <button
            onClick={handleAddWalkin}
            className="btn-primary flex-1"
            disabled={walkinMutation.isPending || !doctor || (mode === 'search' && !selectedPatient)}
          >
            {walkinMutation.isPending ? 'Adding...' : 'Add to Queue'}
          </button>
        </div>
      </div>
    </div>
  );
}
