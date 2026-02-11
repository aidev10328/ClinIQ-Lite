'use client';

type StatCardProps = {
  value: number | string;
  label: string;
  color?: 'primary' | 'accent' | 'gray' | 'warning' | 'success';
  icon?: React.ReactNode;
};

const colorClasses = {
  primary: 'text-primary-600',
  accent: 'text-accent',
  gray: 'text-gray-900',
  warning: 'text-amber-600',
  success: 'text-green-600',
};

export default function StatCard({ value, label, color = 'primary', icon }: StatCardProps) {
  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <div>
          <div className={`text-2xl font-bold ${colorClasses[color]}`}>
            {value}
          </div>
          <div className="text-sm text-gray-500 mt-1">{label}</div>
        </div>
        {icon && (
          <div className="text-gray-400">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
