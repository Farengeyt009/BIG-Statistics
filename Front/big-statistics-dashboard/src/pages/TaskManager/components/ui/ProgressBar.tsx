import React from 'react';

interface ProgressBarProps {
  value: number; // 0-100
  color?: string;
  height?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

const heightClasses = {
  sm: 'h-1',
  md: 'h-2',
  lg: 'h-3',
};

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  color = '#3b82f6',
  height = 'sm',
  showLabel = false,
  className = '',
}) => {
  const percentage = Math.min(Math.max(value, 0), 100);

  return (
    <div className={`w-full ${className}`}>
      {showLabel && (
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-600">Прогресс</span>
          <span className="text-xs font-medium text-gray-900">{percentage}%</span>
        </div>
      )}
      <div className={`w-full bg-gray-100 rounded-full overflow-hidden ${heightClasses[height]}`}>
        <div
          className="h-full rounded-full transition-all duration-300 ease-out"
          style={{
            width: `${percentage}%`,
            backgroundColor: color,
          }}
        />
      </div>
    </div>
  );
};

interface CircularProgressProps {
  value: number; // 0-100
  size?: number;
  strokeWidth?: number;
  color?: string;
  showLabel?: boolean;
}

export const CircularProgress: React.FC<CircularProgressProps> = ({
  value,
  size = 40,
  strokeWidth = 4,
  color = '#3b82f6',
  showLabel = true,
}) => {
  const percentage = Math.min(Math.max(value, 0), 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-300 ease-out"
        />
      </svg>
      {showLabel && (
        <span className="absolute text-xs font-medium text-gray-700">
          {Math.round(percentage)}%
        </span>
      )}
    </div>
  );
};

