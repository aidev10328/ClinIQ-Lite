'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { getPublicQueueStatus, PublicQueueStatus } from '../../../lib/api';

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  QUEUED: { label: 'In Queue', color: 'text-purple-700', bg: 'bg-purple-100' },
  WAITING: { label: 'Waiting', color: 'text-blue-700', bg: 'bg-blue-100' },
  WITH_DOCTOR: { label: 'With Doctor', color: 'text-green-700', bg: 'bg-green-100' },
  COMPLETED: { label: 'Completed', color: 'text-gray-700', bg: 'bg-gray-100' },
  CANCELLED: { label: 'Cancelled', color: 'text-red-700', bg: 'bg-red-100' },
};

export default function PatientStatusPage() {
  const params = useParams();
  const token = params.token as string;

  const [status, setStatus] = useState<PublicQueueStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadStatus() {
      setLoading(true);
      setError(null);

      const { data, error: apiError } = await getPublicQueueStatus(token);

      if (apiError) {
        setError(apiError.message || 'Unable to load queue status');
      } else {
        setStatus(data);
      }

      setLoading(false);
    }

    if (token) {
      loadStatus();
    }
  }, [token]);

  // Auto-refresh every 30 seconds for active statuses
  useEffect(() => {
    if (!status || status.status === 'COMPLETED' || status.status === 'CANCELLED') {
      return;
    }

    const interval = setInterval(async () => {
      const { data } = await getPublicQueueStatus(token);
      if (data) {
        setStatus(data);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [token, status?.status]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your queue status...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Unable to Load Status</h1>
          <p className="text-gray-600">{error}</p>
          <p className="text-sm text-gray-500 mt-4">
            This link may have expired or is invalid.
          </p>
        </div>
      </div>
    );
  }

  if (!status) {
    return null;
  }

  const statusInfo = STATUS_LABELS[status.status] || STATUS_LABELS.QUEUED;
  const isActive = !['COMPLETED', 'CANCELLED'].includes(status.status);

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50 to-white">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-lg mx-auto px-4 py-4">
          <h1 className="text-lg font-semibold text-gray-900 text-center">
            {status.clinicName}
          </h1>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-lg mx-auto px-4 py-8">
        {/* Queue Number Card */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden mb-6">
          <div className="bg-primary-600 px-6 py-4">
            <p className="text-primary-100 text-sm text-center">Your Queue Number</p>
          </div>
          <div className="px-6 py-8 text-center">
            <div className="text-7xl font-bold text-gray-900 mb-2">
              #{status.position}
            </div>
            <div className={`inline-flex items-center px-4 py-2 rounded-full ${statusInfo.bg}`}>
              <span className={`text-sm font-medium ${statusInfo.color}`}>
                {statusInfo.label}
              </span>
            </div>
          </div>
        </div>

        {/* Details Card */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="space-y-4">
            {/* Doctor */}
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-gray-500">Doctor</p>
                <p className="text-sm font-medium text-gray-900">{status.doctorName}</p>
              </div>
            </div>

            {/* People Ahead */}
            {isActive && (
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Patients Ahead</p>
                  <p className="text-sm font-medium text-gray-900">
                    {status.peopleAhead === 0 ? "You're next!" : `${status.peopleAhead} patient${status.peopleAhead > 1 ? 's' : ''}`}
                  </p>
                </div>
              </div>
            )}

            {/* Checked In Time */}
            {status.checkedInAt && (
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Checked In</p>
                  <p className="text-sm font-medium text-gray-900">
                    {new Date(status.checkedInAt).toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true,
                    })}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Status Message */}
        {isActive && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
            <p className="text-sm text-blue-800">
              {status.status === 'WITH_DOCTOR'
                ? "You're currently being seen by the doctor."
                : status.peopleAhead === 0
                  ? "Please be ready, you will be called shortly."
                  : "Please wait in the waiting area. This page updates automatically."}
            </p>
          </div>
        )}

        {/* Completed/Cancelled Message */}
        {!isActive && (
          <div className={`rounded-xl p-4 text-center ${
            status.status === 'COMPLETED' ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'
          }`}>
            <p className={`text-sm ${status.status === 'COMPLETED' ? 'text-green-800' : 'text-gray-700'}`}>
              {status.status === 'COMPLETED'
                ? "Your visit has been completed. Thank you!"
                : "This queue entry has been cancelled."}
            </p>
          </div>
        )}

        {/* Auto-refresh indicator */}
        {isActive && (
          <p className="text-center text-xs text-gray-400 mt-6">
            Auto-refreshes every 30 seconds
          </p>
        )}
      </div>
    </div>
  );
}
