import React from 'react';
import { formatFact, formatNumberK } from '../utils/formatNumber';
import { Truck } from 'lucide-react';

interface ShipmentPlanMetricCardProps {
  title: string | React.ReactNode;
  value: number;
  ytdValue: number;
  percentage: number;
  trendData: number[]; // Массив значений для графика
  color: 'green' | 'red';
  isPlan?: boolean; // Если true, форматирует с K (деление на 1000)
  factValue?: number; // Факт для отображения под планом
  useDonutChart?: boolean; // Если true, использует кольцевую диаграмму вместо графика
  donutValue?: number; // Значение для кольцевой диаграммы (факт)
  donutTotal?: number; // Общее значение для кольцевой диаграммы (план)
  showTitleOnly?: boolean; // Если true, показывает только название плитки
}

const Sparkline: React.FC<{ data: number[]; color: 'green' | 'red' }> = ({ data, color }) => {
  if (!data || data.length === 0) {
    // Генерируем случайные данные для демонстрации, если нет данных
    data = Array.from({ length: 10 }, () => Math.random() * 100);
  }

  const width = 84; // 78-90px
  const height = 24; // 22-26px
  const padding = 2;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  // Нормализуем данные для отображения
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const points = data.map((value, index) => {
    const x = padding + (index / (data.length - 1)) * chartWidth;
    const y = padding + chartHeight - ((value - min) / range) * chartHeight;
    return `${x},${y}`;
  }).join(' ');

  const lineColor = color === 'green' ? '#18A957' : '#D44B4B';

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={lineColor}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

const MiniDonutChart: React.FC<{ value: number; total: number; color: 'green' | 'red' }> = ({ value, total, color }) => {
  const size = 60; // Размер для мини-диаграммы
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const percentage = total > 0 ? (value / total) * 100 : 0;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const primaryColor = color === 'green' ? '#18A957' : '#D44B4B';
  const secondaryColor = color === 'green' ? '#D1FAE5' : '#FEE2E2';

  return (
    <div className="relative inline-flex items-center justify-center">
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
          className="opacity-50"
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
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <div className="text-[10px] font-bold text-gray-900">
            {Math.round(percentage)}%
          </div>
        </div>
      </div>
    </div>
  );
};

export const ShipmentPlanMetricCard: React.FC<ShipmentPlanMetricCardProps> = ({
  title,
  value,
  ytdValue,
  percentage,
  trendData,
  color,
  isPlan = false,
  factValue,
  useDonutChart = false,
  donutValue,
  donutTotal,
  showTitleOnly = false,
}) => {
  // Если показываем только название плитки
  if (showTitleOnly) {
    return (
      <div className="flex items-center justify-end h-full w-full gap-2">
        <span className="text-lg font-semibold text-right" style={{ fontSize: '18px', fontWeight: 600, color: '#111827' }}>
          {title}
        </span>
        <Truck className="text-gray-400" size={48} strokeWidth={1.5} />
      </div>
    );
  }

  // Выбираем функцию форматирования в зависимости от типа значения
  const formatValue = isPlan ? formatNumberK : formatFact;
  const formatYtd = isPlan ? formatNumberK : formatFact;
  
  // Функция для определения цвета бейджа факта по проценту (как в Monthly Plan Performance)
  const getFactBadgeClasses = (percentage: number) => {
    if (percentage < 75) {
      return 'bg-red-100 text-red-700';
    } else if (percentage < 95) {
      return 'bg-orange-100 text-orange-600';
    } else {
      return 'bg-green-100 text-green-700';
    }
  };
  
  // Вычисляем процент выполнения для факта
  const factPercentage = value > 0 && factValue !== undefined ? (factValue / value) * 100 : 0;
  const factBadgeClasses = factValue !== undefined ? getFactBadgeClasses(factPercentage) : '';

  return (
    <div className="flex flex-row items-start gap-3.5" style={{ gap: '12px' }}>
      {/* Левая часть: Sparkline/DonutChart + YTD */}
      <div className="flex flex-col gap-1.5" style={{ width: '101px', minWidth: '101px' }}>
        {useDonutChart && donutValue !== undefined && donutTotal !== undefined ? (
          <MiniDonutChart value={donutValue} total={donutTotal} color={color} />
        ) : (
          <Sparkline data={trendData} color={color} />
        )}
        {!useDonutChart && (
          <div className="text-[10px] leading-[13px]" style={{ lineHeight: '13px' }}>
            <span style={{ color: '#6B7280' }}>{formatYtd(ytdValue)}</span>
            <span style={{ color: '#9AA0A6' }}> Year to date</span>
          </div>
        )}
      </div>

      {/* Правая часть: Title + Percent + Big Value */}
      <div className="flex flex-col gap-1" style={{ minWidth: '140px', gap: '2px' }}>
        {/* Title + Percent в одну линию */}
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold" style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>
            {title}
          </span>
          <span className="text-xs font-semibold" style={{ fontSize: '11px', fontWeight: 600, color: '#9AA0A6' }}>
            {percentage}%
          </span>
        </div>

        {/* Большое значение */}
        <div className="text-[24px] font-bold leading-tight" style={{ fontSize: '24px', fontWeight: 700, lineHeight: '1.0', color: '#111827', marginTop: '2px' }}>
          {formatValue(value)}
        </div>
        
        {/* Факт под планом (если передан) */}
        {factValue !== undefined && (
          <div className="mt-0.5 flex items-center">
            <div className={`font-bold text-[11px] py-1 px-2 rounded inline-block ${factBadgeClasses}`}>
              {formatFact(factValue)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
