'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { getTvDisplayData, TvDisplayData, TvDisplayDoctor } from '../../../lib/api';

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  QUEUED: { label: 'Waiting', color: 'text-primary-700', bg: 'bg-primary-100' },
  WAITING: { label: 'Called', color: 'text-blue-700', bg: 'bg-blue-100' },
  WITH_DOCTOR: { label: 'In Consultation', color: 'text-accent-700', bg: 'bg-accent-100' },
};

function formatWaitTime(minutes: number | null): string {
  if (minutes === null) return '-';
  if (minutes === 0) return 'Now';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function formatTime(date: Date, timezone?: string): string {
  return date.toLocaleTimeString('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatDate(date: Date, timezone?: string): string {
  return date.toLocaleDateString('en-US', {
    timeZone: timezone,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

// Doctor card component for the carousel
function DoctorQueueCard({ doctor, isActive }: { doctor: TvDisplayDoctor; isActive: boolean }) {
  const currentPatient = doctor.currentPatient;
  const waitingPatients = doctor.patients.filter(p => p.status === 'QUEUED' || p.status === 'WAITING');
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isAutoScrolling, setIsAutoScrolling] = useState(true);
  const isCheckedIn = doctor.isCheckedIn;

  // Auto-scroll effect for patient list
  useEffect(() => {
    if (!isActive || waitingPatients.length <= 6 || !isAutoScrolling) return;

    const container = scrollContainerRef.current;
    if (!container) return;

    let scrollDirection = 1; // 1 = down, -1 = up
    const scrollSpeed = 1; // pixels per interval
    const scrollInterval = 50; // ms between scroll updates
    const pauseAtEnd = 3000; // pause at top/bottom in ms

    let isPaused = false;

    const scrollStep = () => {
      if (!container || isPaused) return;

      const maxScroll = container.scrollHeight - container.clientHeight;
      const currentScroll = container.scrollTop;

      // Check if we've reached the bottom
      if (scrollDirection === 1 && currentScroll >= maxScroll - 1) {
        isPaused = true;
        setTimeout(() => {
          scrollDirection = -1;
          isPaused = false;
        }, pauseAtEnd);
        return;
      }

      // Check if we've reached the top
      if (scrollDirection === -1 && currentScroll <= 1) {
        isPaused = true;
        setTimeout(() => {
          scrollDirection = 1;
          isPaused = false;
        }, pauseAtEnd);
        return;
      }

      container.scrollTop += scrollSpeed * scrollDirection;
    };

    const intervalId = setInterval(scrollStep, scrollInterval);

    return () => clearInterval(intervalId);
  }, [isActive, waitingPatients.length, isAutoScrolling]);

  // Determine doctor status display
  const getDoctorStatus = () => {
    if (!isCheckedIn) {
      return {
        label: 'Doctor Not In',
        bgClass: 'bg-gray-400/20',
        dotClass: 'bg-gray-400',
        textClass: 'text-gray-200',
      };
    }
    if (currentPatient) {
      return {
        label: 'In Session',
        bgClass: 'bg-amber-400/20',
        dotClass: 'bg-amber-400',
        textClass: 'text-amber-100',
      };
    }
    return {
      label: 'Available',
      bgClass: 'bg-emerald-400/20',
      dotClass: 'bg-emerald-400 animate-pulse',
      textClass: 'text-emerald-100',
    };
  };

  const status = getDoctorStatus();

  return (
    <div className={`bg-white rounded-2xl shadow-card overflow-hidden transition-all duration-500 ${
      isActive ? 'scale-100 opacity-100' : 'scale-95 opacity-50'
    }`}>
      {/* Doctor Header */}
      <div className={`px-6 py-4 ${isCheckedIn ? 'bg-primary-500' : 'bg-gray-500'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center">
              <span className="text-3xl">👨‍⚕️</span>
            </div>
            <div>
              <h2 className="text-2xl font-heading font-bold text-white">{doctor.doctorName}</h2>
              <p className={`text-sm ${isCheckedIn ? 'text-primary-100' : 'text-gray-200'}`}>
                {doctor.waitingCount} patient{doctor.waitingCount !== 1 ? 's' : ''} waiting
              </p>
            </div>
          </div>
          {/* Doctor Status */}
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${status.bgClass}`}>
            <span className={`w-3 h-3 rounded-full ${status.dotClass}`}></span>
            <span className={`font-semibold ${status.textClass}`}>
              {status.label}
            </span>
          </div>
        </div>
      </div>

      {/* Current Patient - only show if doctor is checked in */}
      {isCheckedIn && currentPatient && (
        <div className="bg-accent-50 border-b-2 border-accent-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-accent-500 rounded-xl flex items-center justify-center">
                <span className="text-3xl font-heading font-black text-white">{currentPatient.token}</span>
              </div>
              <div>
                <p className="text-xs text-accent-600 font-medium uppercase tracking-wider">Now Consulting</p>
                <p className="text-xl font-semibold text-gray-900">{currentPatient.patientName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-accent-500 rounded-full animate-pulse"></span>
              <span className="text-accent-600 font-medium">In Progress</span>
            </div>
          </div>
        </div>
      )}

      {/* Doctor Not In Banner */}
      {!isCheckedIn && (
        <div className="bg-amber-50 border-b-2 border-amber-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-amber-800 font-semibold">Doctor has not checked in yet</p>
              <p className="text-amber-600 text-sm">Estimated wait times will be available once the doctor arrives</p>
            </div>
          </div>
        </div>
      )}

      {/* Waiting List */}
      <div className="px-6 py-4">
        {waitingPatients.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <p className="text-lg">No patients waiting</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Sticky Header - hide Est. Wait column if doctor not checked in */}
            <div className={`grid gap-4 text-xs text-gray-500 uppercase tracking-wider pb-2 border-b border-gray-100 ${
              isCheckedIn ? 'grid-cols-12' : 'grid-cols-9'
            }`}>
              <div className="col-span-2">Token</div>
              <div className={isCheckedIn ? 'col-span-5' : 'col-span-5'}>Patient Name</div>
              <div className="col-span-2 text-center">Status</div>
              {isCheckedIn && <div className="col-span-3 text-right">Est. Wait</div>}
            </div>
            {/* Scrollable Patient List */}
            <div
              ref={scrollContainerRef}
              className="max-h-[400px] overflow-y-auto scrollbar-hide space-y-3"
              onMouseEnter={() => setIsAutoScrolling(false)}
              onMouseLeave={() => setIsAutoScrolling(true)}
            >
              {waitingPatients.map((patient, idx) => (
                <div
                  key={`${patient.token}-${idx}`}
                  className={`grid gap-4 items-center py-3 rounded-lg ${
                    isCheckedIn ? 'grid-cols-12' : 'grid-cols-9'
                  } ${idx === 0 ? 'bg-blue-50' : ''}`}
                >
                  <div className="col-span-2">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                      patient.status === 'WAITING' ? 'bg-blue-500 text-white' : 'bg-primary-100 text-primary-700'
                    }`}>
                      <span className="text-xl font-heading font-bold">{patient.token}</span>
                    </div>
                  </div>
                  <div className={isCheckedIn ? 'col-span-5' : 'col-span-5'}>
                    <p className="text-lg font-medium text-gray-900 truncate">{patient.patientName}</p>
                    {patient.priority !== 'NORMAL' && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        patient.priority === 'EMERGENCY' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {patient.priority}
                      </span>
                    )}
                  </div>
                  <div className="col-span-2 text-center">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      STATUS_LABELS[patient.status]?.bg || 'bg-gray-100'
                    } ${STATUS_LABELS[patient.status]?.color || 'text-gray-700'}`}>
                      {STATUS_LABELS[patient.status]?.label || patient.status}
                    </span>
                  </div>
                  {isCheckedIn && (
                    <div className="col-span-3 text-right">
                      <span className="text-xl font-heading font-semibold text-primary-600">
                        {formatWaitTime(patient.estimatedWaitMin)}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {waitingPatients.length > 6 && (
              <p className="text-center text-gray-400 text-xs pt-1">
                {waitingPatients.length} patients total • Auto-scrolling
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function TvDisplayPage() {
  const params = useParams();
  const clinicId = params.clinicId as string;

  const [data, setData] = useState<TvDisplayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentDoctorIndex, setCurrentDoctorIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Fetch data
  const fetchData = useCallback(async () => {
    const { data: tvData, error: apiError } = await getTvDisplayData(clinicId);
    if (apiError) {
      setError(apiError.message || 'Unable to load queue data');
    } else {
      setData(tvData);
      setError(null);
    }
    setLoading(false);
  }, [clinicId]);

  // Initial load and auto-refresh every 10 seconds
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Update clock every second
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-rotate doctors every 8 seconds if multiple doctors
  useEffect(() => {
    if (!data || data.doctors.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentDoctorIndex(prev => (prev + 1) % data.doctors.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [data?.doctors.length]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-100 border-t-primary-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500 text-lg">Loading queue display...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center bg-white rounded-2xl p-8 shadow-card max-w-md">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">⚠️</span>
          </div>
          <h1 className="text-xl font-heading font-semibold text-gray-900 mb-2">Display Unavailable</h1>
          <p className="text-gray-500">{error || 'Unable to load queue information.'}</p>
        </div>
      </div>
    );
  }

  const hasPatients = data.doctors.length > 0;
  const currentDoctor = data.doctors[currentDoctorIndex];

  return (
    <div className="min-h-screen bg-background font-sans">
      {/* Header */}
      <div className="bg-primary-600 px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <span className="text-2xl">🏥</span>
            </div>
            <div>
              <h1 className="text-2xl font-heading font-bold text-white">{data.clinicName}</h1>
              <p className="text-primary-100 text-sm">Queue Status Display</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-4xl font-heading font-bold text-white">{formatTime(currentTime, data.timezone)}</p>
            <p className="text-primary-100 text-sm">
              {formatDate(currentTime, data.timezone)}
            </p>
          </div>
        </div>
      </div>

      {/* Summary Bar */}
      <div className="bg-white border-b border-gray-100 px-8 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-8">
            {/* Total in Queue (not completed) */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <span className="text-blue-600">📋</span>
              </div>
              <div>
                <p className="text-2xl font-heading font-bold text-blue-600">{data.totalInQueue}</p>
                <p className="text-xs text-gray-500">In Queue</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
                <span className="text-primary-600">👥</span>
              </div>
              <div>
                <p className="text-2xl font-heading font-bold text-primary-600">{data.totalWaiting}</p>
                <p className="text-xs text-gray-500">Waiting</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-accent-100 rounded-lg flex items-center justify-center">
                <span className="text-accent-600">🩺</span>
              </div>
              <div>
                <p className="text-2xl font-heading font-bold text-accent-600">{data.totalWithDoctor}</p>
                <p className="text-xs text-gray-500">In Consultation</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                <span className="text-gray-600">👨‍⚕️</span>
              </div>
              <div>
                <p className="text-2xl font-heading font-bold text-gray-700">
                  {data.doctors.filter(d => d.isCheckedIn).length}/{data.doctors.length}
                </p>
                <p className="text-xs text-gray-500">Doctors In</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                data.doctors.filter(d => d.isCheckedIn && !d.currentPatient).length > 0 ? 'bg-emerald-100' : 'bg-amber-100'
              }`}>
                <span className={`w-3 h-3 rounded-full ${
                  data.doctors.filter(d => d.isCheckedIn && !d.currentPatient).length > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                }`}></span>
              </div>
              <div>
                <p className={`text-2xl font-heading font-bold ${
                  data.doctors.filter(d => d.isCheckedIn && !d.currentPatient).length > 0 ? 'text-emerald-600' : 'text-amber-600'
                }`}>
                  {data.doctors.filter(d => d.isCheckedIn && !d.currentPatient).length}
                </p>
                <p className="text-xs text-gray-500">Available</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-accent-500 rounded-full animate-pulse"></span>
            <span className="text-sm text-gray-500">Live Updates</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-8">
        {!hasPatients ? (
          <div className="flex items-center justify-center h-[60vh]">
            <div className="text-center">
              <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-5xl">🏥</span>
              </div>
              <h2 className="text-3xl font-heading font-semibold text-gray-700 mb-2">No Patients in Queue</h2>
              <p className="text-xl text-gray-400">The waiting room is currently empty</p>
            </div>
          </div>
        ) : data.doctors.length === 1 ? (
          // Single doctor - full width display
          <DoctorQueueCard doctor={data.doctors[0]} isActive={true} />
        ) : (
          // Multiple doctors - carousel with indicators
          <div>
            <DoctorQueueCard doctor={currentDoctor} isActive={true} />

            {/* Doctor indicators */}
            <div className="flex items-center justify-center gap-3 mt-6">
              {data.doctors.map((doctor, idx) => (
                <button
                  key={doctor.doctorId}
                  onClick={() => setCurrentDoctorIndex(idx)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${
                    idx === currentDoctorIndex
                      ? doctor.isCheckedIn ? 'bg-primary-500 text-white shadow-md' : 'bg-gray-500 text-white shadow-md'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${
                    idx === currentDoctorIndex
                      ? 'bg-white'
                      : doctor.isCheckedIn ? 'bg-emerald-400' : 'bg-gray-400'
                  }`}></span>
                  <span className="text-sm font-medium">{doctor.doctorName}</span>
                  {!doctor.isCheckedIn && idx !== currentDoctorIndex && (
                    <span className="text-xs text-gray-400">(Not In)</span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    idx === currentDoctorIndex ? 'bg-white/20' : 'bg-gray-100'
                  }`}>
                    {doctor.waitingCount}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-800 px-8 py-3">
        <div className="flex items-center justify-between text-sm">
          <p className="text-gray-400">
            Token numbers are called in order. Please listen for your number.
          </p>
          <p className="text-gray-500">
            Last updated: {new Date(data.generatedAt).toLocaleTimeString()}
          </p>
        </div>
      </div>
    </div>
  );
}
