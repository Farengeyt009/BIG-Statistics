import React from 'react';

interface MetricCardProps {
  label: string;
  value: string;          // «6.22k», «2m 15s»
  rawValue?: number;      // для всплывающей подсказки
  changePercent: number;  // -10 → «-10 %»
  isPositiveMetric?: boolean; // true, если рост = хорошо (Views)
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  rawValue,
  changePercent,
  isPositiveMetric = true,
}) => {
  const direction = changePercent === 0 ? 'flat' : changePercent > 0 ? 'up' : 'down';
  const good      = isPositiveMetric ? changePercent >= 0 : changePercent <= 0;

  // цвета бэйджа
  const badgeText = changePercent === 0 ? 'text-orange-600' : (good ? 'text-green-700' : 'text-red-700');
  const badgeBg   = changePercent === 0 ? 'bg-orange-100' : (good ? 'bg-green-100' : 'bg-red-100');

  // угол поворота стрелки
  const arrowRotate =
    direction === 'flat' ? 'rotate-0'
    : direction === 'up' ? '-rotate-90'      // вверх
    : /* down */         'rotate-90';        // вниз

  return (
    <div className="flex flex-col justify-center min-w-[150px] first:pl-0 px-4">
      {/* label */}
      <div className="font-bold text-xs whitespace-nowrap text-base800">
        {label}
      </div>

      {/* value */}
      <div
        className="font-bold text-base36 leading-[1.5] whitespace-nowrap text-base900"
        title={rawValue?.toString()}
      >
        {value}
      </div>

      {/* change badge */}
      <div
        className={`flex items-center gap-[5px] font-bold text-xs py-[0.1em] px-[0.5em] rounded-[5px] self-start ${badgeText} ${badgeBg}`}
        title={`${changePercent > 0 ? '+' : ''}${changePercent}%`}
      >
        {/* arrow icon */}
        {changePercent === 0 ? (
          <span className="text-xs font-bold">-</span>
        ) : (
          <svg
            className={`w-[0.8em] h-[0.8em] ${arrowRotate}`}
            viewBox="0 0 24 24"
            aria-hidden="true"
            fill="currentColor"
          >
            <path d="M22.414 12 14 20.414 12.586 19l6-6H2v-2h16.586l-6-6L14 3.586z" />
          </svg>
        )}
        <span>{Math.abs(changePercent)}%</span>
      </div>
    </div>
  );
}; 