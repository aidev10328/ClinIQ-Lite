'use client';

import type { Slot, SlotPeriod } from '../../lib/slots';
import { getPeriodLabel, countSlots } from '../../lib/slots';
import SlotCard from './SlotCard';

type SlotColumnProps = {
  period: SlotPeriod;
  slots: Slot[];
  onBook: (slot: Slot) => void;
  onCancel: (slot: Slot) => void;
  onReschedule?: (slot: Slot) => void;
  readOnly?: boolean; // If true, hide all action buttons (for view-only users)
};

const PERIOD_COLORS = {
  morning: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    header: 'bg-amber-100 text-amber-800',
    icon: '🌅',
  },
  afternoon: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    header: 'bg-blue-100 text-blue-800',
    icon: '☀️',
  },
};

export default function SlotColumn({
  period,
  slots,
  onBook,
  onCancel,
  onReschedule,
  readOnly = false,
}: SlotColumnProps) {
  const colors = PERIOD_COLORS[period];
  const { open, booked } = countSlots(slots);

  return (
    <div className={`rounded-lg border ${colors.border} ${colors.bg} overflow-hidden flex flex-col h-full`}>
      {/* Compact Header */}
      <div className={`${colors.header} px-2 py-1.5 flex items-center justify-between flex-shrink-0`}>
        <div className="flex items-center gap-1">
          <span className="text-xs">{colors.icon}</span>
          <span className="text-[11px] font-medium">{getPeriodLabel(period)}</span>
        </div>
        <div className="text-[9px] flex gap-1">
          {open > 0 && (
            <span className="bg-white/60 px-1 py-0.5 rounded">{open}</span>
          )}
          {booked > 0 && (
            <span className="bg-primary-200/60 px-1 py-0.5 rounded">{booked}</span>
          )}
        </div>
      </div>

      {/* Slots - scrollable */}
      <div className="p-1.5 space-y-1 overflow-y-auto flex-1">
        {slots.length === 0 ? (
          <div className="text-center py-4 text-gray-400 text-[10px]">
            No slots
          </div>
        ) : (
          slots.map((slot) => (
            <SlotCard
              key={slot.id}
              slot={slot}
              onBook={onBook}
              onCancel={onCancel}
              onReschedule={onReschedule}
              readOnly={readOnly}
            />
          ))
        )}
      </div>
    </div>
  );
}
