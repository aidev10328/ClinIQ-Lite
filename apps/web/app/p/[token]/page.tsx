'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { getPublicQueueStatus, PublicQueueStatus } from '../../../lib/api';

const STATUS_CONFIG: Record<string, { label: string; bg: string; border: string; icon: string }> = {
  QUEUED: { label: 'Waiting in Queue', bg: 'bg-primary-50', border: 'border-primary-200', icon: '⏳' },
  WAITING: { label: 'You Have Been Called', bg: 'bg-blue-50', border: 'border-blue-300', icon: '📢' },
  WITH_DOCTOR: { label: 'With Doctor Now', bg: 'bg-accent-50', border: 'border-accent-300', icon: '👨‍⚕️' },
  COMPLETED: { label: 'Visit Completed', bg: 'bg-gray-50', border: 'border-gray-200', icon: '✅' },
  CANCELLED: { label: 'Cancelled', bg: 'bg-red-50', border: 'border-red-200', icon: '❌' },
};

function formatWaitTime(minutes: number): string {
  if (minutes < 1) return 'Any moment';
  if (minutes < 60) return `~${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `~${hours}h ${mins}m` : `~${hours}h`;
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

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
    if (token) loadStatus();
  }, [token]);

  useEffect(() => {
    if (!status || status.status === 'COMPLETED' || status.status === 'CANCELLED') return;
    const interval = setInterval(async () => {
      const { data } = await getPublicQueueStatus(token);
      if (data) setStatus(data);
    }, 30000);
    return () => clearInterval(interval);
  }, [token, status?.status]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-primary-100 border-t-primary-500 rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-gray-500 text-sm font-sans">Loading...</p>
        </div>
      </div>
    );
  }

  if (error || !status) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-6 shadow-card max-w-sm w-full text-center">
          <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">⚠️</span>
          </div>
          <h1 className="text-lg font-heading font-semibold text-gray-900 mb-2">Invalid Link</h1>
          <p className="text-gray-500 text-sm font-sans">{error || 'This link is expired or invalid. Please contact the clinic for assistance.'}</p>
        </div>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[status.status] || STATUS_CONFIG.QUEUED;
  const isActive = !['COMPLETED', 'CANCELLED'].includes(status.status);
  const isWithDoctor = status.status === 'WITH_DOCTOR';
  const isCalled = status.status === 'WAITING';
  const showWaitTime = isActive && !isWithDoctor && !isCalled && status.estimatedWaitMinutes !== null;

  return (
    <div className="min-h-screen bg-background font-sans">
      {/* Header */}
      <div className="bg-primary-600 text-white px-4 py-3">
        <h1 className="text-sm font-heading font-semibold truncate">{status.clinicName}</h1>
      </div>

      <div className="p-4 space-y-4">
        {/* Token Card */}
        <div className="bg-white rounded-2xl shadow-card overflow-hidden">
          <div className="bg-primary-500 px-4 py-6 text-center">
            <p className="text-primary-100 text-xs font-medium uppercase tracking-widest mb-2">Your Token Number</p>
            <p className="text-7xl font-heading font-black text-white">{status.position}</p>
          </div>

          <div className={`px-4 py-3 ${statusConfig.bg} border-t-2 ${statusConfig.border}`}>
            <div className="flex items-center justify-center gap-2">
              <span className="text-xl">{statusConfig.icon}</span>
              <span className="text-sm font-semibold text-gray-800">{statusConfig.label}</span>
              {isActive && (
                <span className="w-2 h-2 rounded-full bg-accent-500 animate-pulse"></span>
              )}
            </div>
          </div>
        </div>

        {/* Alert Card - Called */}
        {isCalled && (
          <div className="bg-blue-600 rounded-xl p-4 text-center shadow-card">
            <p className="text-white font-semibold">Please proceed to the consultation room</p>
          </div>
        )}

        {/* Alert Card - With Doctor */}
        {isWithDoctor && (
          <div className="bg-accent-500 rounded-xl p-4 text-center shadow-card">
            <p className="text-white font-semibold">Your consultation is in progress</p>
          </div>
        )}

        {/* Completed/Cancelled Card */}
        {!isActive && (
          <div className={`rounded-xl p-4 text-center shadow-card ${
            status.status === 'COMPLETED' ? 'bg-accent-500' : 'bg-red-500'
          }`}>
            <p className="text-white font-semibold">
              {status.status === 'COMPLETED' ? 'Thank you for your visit!' : 'This queue entry was cancelled'}
            </p>
          </div>
        )}

        {/* Wait Time Card */}
        {showWaitTime && (
          <div className="bg-white rounded-xl p-4 shadow-card text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Estimated Wait Time</p>
            <p className="text-3xl font-heading font-bold text-primary-600">
              {formatWaitTime(status.estimatedWaitMinutes!)}
            </p>
          </div>
        )}

        {/* Doctor Info */}
        <div className="bg-white rounded-xl p-4 shadow-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
              <span className="text-primary-600 text-lg">👨‍⚕️</span>
            </div>
            <div>
              <p className="text-xs text-gray-500">Consulting Doctor</p>
              <p className="text-sm font-semibold text-gray-900">{status.doctorName}</p>
            </div>
            <div className="ml-auto">
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                status.source === 'WALKIN'
                  ? 'bg-orange-100 text-orange-700'
                  : 'bg-primary-100 text-primary-700'
              }`}>
                {status.source === 'WALKIN' ? 'Walk-in' : 'Appointment'}
              </span>
            </div>
          </div>
        </div>

        {/* Queue Info Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Patients Before You */}
          <div className="bg-white rounded-xl p-4 shadow-card text-center">
            <p className="text-xs text-gray-500 mb-1">Patients Before You</p>
            <p className="text-3xl font-heading font-bold text-primary-600">{status.peopleAhead}</p>
            <p className="text-xs text-gray-400">
              {status.peopleAhead === 0 ? "You're next!" : status.peopleAhead === 1 ? 'person' : 'people'}
            </p>
          </div>

          {/* Doctor Availability */}
          <div className="bg-white rounded-xl p-4 shadow-card text-center">
            <p className="text-xs text-gray-500 mb-1">Doctor Availability</p>
            <div className="flex items-center justify-center gap-2">
              <span className={`w-3 h-3 rounded-full ${
                status.isDoctorBusy ? 'bg-amber-400' : 'bg-accent-500'
              } ${!status.isDoctorBusy && isActive ? 'animate-pulse' : ''}`}></span>
              <p className={`text-lg font-bold ${
                status.isDoctorBusy ? 'text-amber-600' : 'text-accent-600'
              }`}>
                {status.isDoctorBusy ? 'In Session' : 'Available'}
              </p>
            </div>
            <p className="text-xs text-gray-400">
              {status.isDoctorBusy ? 'With a patient' : 'Ready to see you'}
            </p>
          </div>
        </div>

        {/* Check-in Time */}
        {status.checkedInAt && (
          <div className="bg-white rounded-xl p-3 shadow-card">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-gray-400">🕐</span>
                <span className="text-xs text-gray-500">
                  {status.source === 'WALKIN' ? 'Arrived at' : 'Checked in at'}
                </span>
              </div>
              <span className="text-sm font-medium text-gray-800">{formatTime(status.checkedInAt)}</span>
            </div>
          </div>
        )}

        {/* Footer Message */}
        {isActive && !isWithDoctor && !isCalled && (
          <p className="text-center text-xs text-gray-400">
            {status.peopleAhead === 0
              ? "Please stay nearby. You'll be called shortly."
              : "This page updates automatically every 30 seconds."}
          </p>
        )}

        {/* Live Indicator */}
        {isActive && (
          <div className="flex items-center justify-center gap-2 pt-2">
            <span className="w-2 h-2 rounded-full bg-accent-500 animate-pulse"></span>
            <span className="text-xs text-gray-400 font-medium">Live Status</span>
          </div>
        )}
      </div>
    </div>
  );
}
