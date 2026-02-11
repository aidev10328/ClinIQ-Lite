'use client';

import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Slot } from '../../lib/slots';
import type { Patient, Doctor } from '../../lib/api';
import { searchPatients, createPatient, createAppointment } from '../../lib/api';
import { formatTimeFromString, formatDateDisplay } from '../../lib/slots';
import PhoneInput, { isValidPhone, isValidEmail, formatPhoneDisplay } from '../PhoneInput';

// Common reasons for visit
const VISIT_REASONS = [
  'General Checkup',
  'Follow-up Visit',
  'Consultation',
  'Fever / Cold',
  'Pain / Discomfort',
  'Vaccination',
  'Lab Results Review',
  'Prescription Refill',
  'Other',
];

type BookAppointmentModalProps = {
  isOpen: boolean;
  onClose: () => void;
  slot: Slot | null;
  doctor: Doctor | null;
  selectedDate: Date;
  onSuccess: () => void;
};

export default function BookAppointmentModal({
  isOpen,
  onClose,
  slot,
  doctor,
  selectedDate,
  onSuccess,
}: BookAppointmentModalProps) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'search' | 'new'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [searching, setSearching] = useState(false);

  // New patient form
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [reason, setReason] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleBook = async () => {
    if (!slot || !doctor) return;

    setSubmitting(true);
    setError(null);

    try {
      let patientId: string;

      if (mode === 'new') {
        if (!firstName.trim()) {
          setError('First name is required');
          setSubmitting(false);
          return;
        }
        if (!lastName.trim()) {
          setError('Last name is required');
          setSubmitting(false);
          return;
        }

        if (phone && !isValidPhone(phone)) {
          setError('Phone number must be 10 digits');
          setSubmitting(false);
          return;
        }

        if (email.trim() && !isValidEmail(email.trim())) {
          setError('Please enter a valid email address');
          setSubmitting(false);
          return;
        }

        const fullName = `${firstName.trim()} ${lastName.trim()}`;

        const { data: patient, error: patientError } = await createPatient({
          fullName,
          phone: phone.trim() || undefined,
        });

        if (patientError || !patient) {
          setError(patientError?.message || 'Failed to create patient');
          setSubmitting(false);
          return;
        }

        patientId = patient.id;
      } else {
        if (!selectedPatient) {
          setError('Please select a patient');
          setSubmitting(false);
          return;
        }
        patientId = selectedPatient.id;
      }

      // Create appointment
      const { error: apptError } = await createAppointment({
        doctorId: doctor.id,
        patientId,
        slotId: slot.id,
        startsAt: slot.startsAt.toISOString(),
        reason: reason || undefined,
      });

      if (apptError) {
        setError(apptError.message || 'Failed to create appointment');
        setSubmitting(false);
        return;
      }

      // Invalidate patients query if a new patient was created
      if (mode === 'new') {
        queryClient.invalidateQueries({ queryKey: ['patients'] });
      }

      onSuccess();
      onClose();
    } catch (e) {
      setError('An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !slot) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal - Standard size */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">Book Appointment</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-4 max-h-[70vh] overflow-y-auto">
          {/* Slot info - compact */}
          <div className="bg-primary-50 rounded-lg p-3 mb-4 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-900">{doctor?.fullName}</div>
              <div className="text-xs text-gray-500">{formatDateDisplay(selectedDate)}</div>
            </div>
            <div className="text-lg font-bold text-primary-700">{formatTimeFromString(slot.time)}</div>
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
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-700 mb-1">Search Patient</label>
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
                <div className="mb-3 max-h-32 overflow-y-auto border border-gray-200 rounded-lg">
                  {searching ? (
                    <div className="p-2 text-sm text-gray-500 text-center">Searching...</div>
                  ) : searchResults.length === 0 ? (
                    <div className="p-2 text-sm text-gray-500 text-center">No patients found</div>
                  ) : (
                    searchResults.map((patient) => (
                      <button
                        key={patient.id}
                        onClick={() => setSelectedPatient(patient)}
                        className={`w-full text-left px-3 py-2 border-b border-gray-100 last:border-0 hover:bg-gray-50 ${
                          selectedPatient?.id === patient.id ? 'bg-primary-50' : ''
                        }`}
                      >
                        <div className="text-sm font-medium text-gray-900">{patient.fullName}</div>
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
                <div className="bg-green-50 border border-green-200 rounded-lg p-2 mb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-green-800">{selectedPatient.fullName}</div>
                      {selectedPatient.phone && (
                        <div className="text-xs text-green-600">{formatPhoneDisplay(selectedPatient.phone)}</div>
                      )}
                    </div>
                    <button onClick={() => setSelectedPatient(null)} className="text-green-600 hover:text-green-800">
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
              {/* New patient form - compact */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">First Name *</label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="First name"
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Last Name *</label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Last name"
                      className="input-field"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
                  <PhoneInput
                    value={phone}
                    onChange={(fullPhone) => setPhone(fullPhone)}
                    placeholder="10-digit number"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@example.com"
                    className={`input-field ${email && !isValidEmail(email) ? 'border-red-300' : ''}`}
                  />
                </div>
              </div>
            </>
          )}

          {/* Reason for visit - Dropdown */}
          <div className="mt-4">
            <label className="block text-xs font-medium text-gray-700 mb-1">Reason for Visit</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="input-field"
            >
              <option value="">Select reason...</option>
              {VISIT_REASONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* Error */}
          {error && (
            <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 py-3 border-t border-gray-200 bg-gray-50">
          <button onClick={onClose} className="btn-secondary flex-1" disabled={submitting}>
            Cancel
          </button>
          <button
            onClick={handleBook}
            className="btn-primary flex-1"
            disabled={submitting || (mode === 'search' && !selectedPatient)}
          >
            {submitting ? 'Booking...' : 'Book'}
          </button>
        </div>
      </div>
    </div>
  );
}
