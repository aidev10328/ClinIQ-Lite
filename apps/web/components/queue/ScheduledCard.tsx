'use client';

import type { Appointment } from '../../lib/api';

type ScheduledCardProps = {
  appointment: Appointment;
  onCheckin: (appointment: Appointment) => void;
  onNoShow: (appointment: Appointment) => void;
  isLoading?: boolean;
};

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export default function ScheduledCard({
  appointment,
  onCheckin,
  onNoShow,
  isLoading,
}: ScheduledCardProps) {
  const isPast = new Date(appointment.startsAt) < new Date();

  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-3 shadow-sm ${isPast ? 'border-l-4 border-l-amber-400' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-gray-900">
              {formatTime(appointment.startsAt)}
            </span>
            {isPast && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
                Past Due
              </span>
            )}
          </div>
          <div className="text-sm font-medium text-gray-800 truncate">
            {appointment.patient.fullName}
          </div>
          {appointment.patient.phone && (
            <div className="text-xs text-gray-500 mt-0.5">
              {appointment.patient.phone}
            </div>
          )}
        </div>
      </div>
      <div className="flex gap-2 mt-2">
        <button
          onClick={() => onCheckin(appointment)}
          disabled={isLoading}
          className="flex-1 text-xs py-1.5 px-2 bg-green-50 text-green-700 rounded hover:bg-green-100 transition-colors font-medium disabled:opacity-50"
        >
          {isLoading ? 'Checking in...' : 'Check In'}
        </button>
        <button
          onClick={() => onNoShow(appointment)}
          disabled={isLoading}
          className="text-xs py-1.5 px-2 text-gray-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
        >
          No Show
        </button>
      </div>
    </div>
  );
}
