'use client';

import type { Slot } from '../../lib/slots';
import { formatTimeFromString } from '../../lib/slots';

type SlotCardProps = {
  slot: Slot;
  onBook: (slot: Slot) => void;
  onCancel: (slot: Slot) => void;
  onReschedule?: (slot: Slot) => void;
  readOnly?: boolean; // If true, hide all action buttons (for view-only users)
};

export default function SlotCard({ slot, onBook, onCancel, onReschedule, readOnly = false }: SlotCardProps) {
  // Use slot.time (HH:MM in clinic timezone) for consistent display
  const timeDisplay = formatTimeFromString(slot.time);

  // Booked slot with appointment details
  if (slot.isBooked && slot.appointment) {
    const { appointment } = slot;
    const status = appointment.status;

    // Determine styling based on status
    const getStatusStyles = () => {
      switch (status) {
        case 'CHECKED_IN':
          return {
            bg: 'bg-blue-50',
            border: 'border-blue-200',
            badge: 'bg-blue-100 text-blue-700',
            badgeText: 'In Queue',
          };
        case 'COMPLETED':
          return {
            bg: 'bg-green-50',
            border: 'border-green-200',
            badge: 'bg-green-100 text-green-700',
            badgeText: 'Completed',
          };
        case 'NO_SHOW':
          return {
            bg: 'bg-red-50',
            border: 'border-red-200',
            badge: 'bg-red-100 text-red-700',
            badgeText: 'No Show',
          };
        case 'CANCELLED':
          return {
            bg: 'bg-gray-50',
            border: 'border-gray-200',
            badge: 'bg-gray-100 text-gray-600',
            badgeText: 'Cancelled',
          };
        case 'RESCHEDULED':
          return {
            bg: 'bg-orange-50',
            border: 'border-orange-200',
            badge: 'bg-orange-100 text-orange-700',
            badgeText: 'Rescheduled',
          };
        default:
          return {
            bg: 'bg-white',
            border: 'border-gray-200',
            badge: '',
            badgeText: '',
          };
      }
    };

    const styles = getStatusStyles();
    const canModify = status === 'BOOKED';

    return (
      <div className={`${styles.bg} border ${styles.border} rounded p-1.5 shadow-sm`}>
        <div className="flex items-start gap-1">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-semibold text-gray-900">
                {timeDisplay}
              </span>
              {styles.badgeText && (
                <span className={`text-[8px] px-1 py-0.5 rounded ${styles.badge}`}>
                  {styles.badgeText}
                </span>
              )}
            </div>
            <div className="text-[11px] font-medium text-gray-800 truncate">
              {appointment.patient.fullName}
            </div>
            {appointment.reason && (
              <div className="text-[10px] text-primary-600 truncate">
                {appointment.reason}
              </div>
            )}
          </div>
          {canModify && !readOnly && (
            <div className="flex items-center gap-0.5">
              {onReschedule && (
                <button
                  onClick={() => onReschedule(slot)}
                  className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                  title="Reschedule"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </button>
              )}
              <button
                onClick={() => onCancel(slot)}
                className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                title="Cancel"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Booked slot without appointment details (fallback)
  if (slot.isBooked) {
    return (
      <div className="bg-primary-50 border border-primary-200 rounded p-1.5">
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-primary-500"></span>
          <span className="text-[11px] font-medium text-gray-900">{timeDisplay}</span>
          <span className="text-[10px] text-primary-600 ml-auto">Booked</span>
        </div>
      </div>
    );
  }

  // Open slot - check if past
  if (slot.isPast) {
    // Past slot: show grayed out, not bookable
    return (
      <div className="w-full bg-gray-50 border border-gray-200 rounded p-1.5 opacity-50">
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
          <span className="text-[11px] font-medium text-gray-500">{timeDisplay}</span>
          <span className="text-[10px] text-gray-400 ml-auto">Past</span>
        </div>
      </div>
    );
  }

  if (readOnly) {
    // Read-only: just show the slot without click action
    return (
      <div className="w-full bg-green-50 border border-green-200 rounded p-1.5">
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
          <span className="text-[11px] font-medium text-gray-900">{timeDisplay}</span>
          <span className="text-[10px] text-green-600 ml-auto">Available</span>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => onBook(slot)}
      className="w-full bg-green-50 border border-green-200 rounded p-1.5 text-left hover:bg-green-100 transition-colors group"
    >
      <div className="flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
        <span className="text-[11px] font-medium text-gray-900">{timeDisplay}</span>
        <span className="text-[10px] text-green-600 ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
          + Book
        </span>
      </div>
    </button>
  );
}
