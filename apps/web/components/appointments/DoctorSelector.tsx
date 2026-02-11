'use client';

import type { Doctor } from '../../lib/api';

type DoctorSelectorProps = {
  doctors: Doctor[];
  selectedDoctorId: string | null;
  onSelect: (doctorId: string) => void;
  loading?: boolean;
  showTitle?: boolean;
  compact?: boolean;
};

export default function DoctorSelector({
  doctors,
  selectedDoctorId,
  onSelect,
  loading,
  showTitle = false,
  compact = false,
}: DoctorSelectorProps) {
  const selectedDoctor = doctors.find(d => d.id === selectedDoctorId);

  if (showTitle && selectedDoctor) {
    // Enhanced display with title/specialization visible
    return (
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
          <span className="text-teal-700 font-bold text-sm">
            {selectedDoctor.fullName.charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <select
            value={selectedDoctorId || ''}
            onChange={(e) => onSelect(e.target.value)}
            className="w-full text-sm font-medium text-gray-800 bg-transparent border-none focus:outline-none focus:ring-0 cursor-pointer p-0"
            disabled={loading || doctors.length === 0}
          >
            {doctors.length === 0 ? (
              <option value="">No doctors available</option>
            ) : (
              <>
                <option value="" disabled>
                  Select a doctor
                </option>
                {doctors.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>
                    Dr. {doctor.fullName}
                  </option>
                ))}
              </>
            )}
          </select>
          <p className="text-[10px] text-gray-500 -mt-0.5">{selectedDoctor.specialization}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {!compact && <label className="field-label">Doctor</label>}
      <select
        value={selectedDoctorId || ''}
        onChange={(e) => onSelect(e.target.value)}
        className={compact ? "text-sm font-medium bg-transparent border-none focus:outline-none p-0" : "input-field"}
        disabled={loading || doctors.length === 0}
      >
        {doctors.length === 0 ? (
          <option value="">No doctors available</option>
        ) : (
          <>
            <option value="" disabled>
              Select a doctor
            </option>
            {doctors.map((doctor) => (
              <option key={doctor.id} value={doctor.id}>
                Dr. {doctor.fullName} - {doctor.specialization}
              </option>
            ))}
          </>
        )}
      </select>
    </div>
  );
}
