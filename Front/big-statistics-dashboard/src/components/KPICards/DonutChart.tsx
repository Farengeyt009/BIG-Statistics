import React from 'react';

interface DonutChartProps {
  value: number;           // текущее значение (0-100)
  total: number;           // общее значение
  size?: number;           // размер диаграммы в пикселях
  strokeWidth?: number;    // толщина кольца
  primaryColor?: string;   // цвет заполненной части
  secondaryColor?: string; // цвет незаполненной части
  showPercentage?: boolean; // показывать ли процент в центре
  className?: string;      // дополнительные CSS классы
}

export const DonutChart: React.FC<DonutChartProps> = ({
  value,
  total,
  size = 120,
  strokeWidth = 12,
  primaryColor = '#1e40af', // blue-700 (факт)
  secondaryColor = '#dbeafe', // blue-100 (план)
  showPercentage = true,
  className = '',
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const percentage = total > 0 ? (value / total) * 100 : 0;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        {/* Фоновое кольцо */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={secondaryColor}
          strokeWidth={strokeWidth}
          fill="transparent"
          className="opacity-30"
        />
        
        {/* Заполненное кольцо */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={primaryColor}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      
      {/* Центральный текст с процентом */}
      {showPercentage && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="text-lg font-bold text-gray-900">
              {Math.round(percentage)}%
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 