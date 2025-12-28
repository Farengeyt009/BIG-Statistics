// MonthlyPlanCard.tsx
import React, { useMemo } from "react";
import { Circle } from "lucide-react";

type GroupRow = {
  group: string;   // "Heater"
  plan: number;    // 205856
  fact: number;    // 154928
  percent?: number; // 75.3 (optional)
};

type MonthlyPlanCardProps = {
  title?: string; // default "Monthly Plan"
  rows: GroupRow[];
  onClick?: () => void;

  // Use your existing formatters
  formatFact: (n: number) => string;
  formatNumberK?: (n: number) => string; // optional if you prefer K
};

const getBadgeClasses = (percentage: number) => {
  if (percentage < 75) return "bg-red-100 text-red-700";
  if (percentage < 95) return "bg-orange-100 text-orange-600";
  return "bg-green-100 text-green-700";
};

const getColorByPercentage = (percentage: number) => {
  if (percentage < 75) return "#b91c1c"; // red-700
  if (percentage < 95) return "#ea580c"; // orange-600
  return "#15803d"; // green-700
};

const getProgressBarColor = (percentage: number) => {
  // Используем цвета фона бейджей из Shipment Plan (условное форматирование)
  if (percentage < 75) return "#FEE2E2"; // bg-red-100
  if (percentage < 95) return "#FFEDD5"; // bg-orange-100
  return "#D1FAE5"; // bg-green-100
};

const getProgressBarTextColor = (percentage: number) => {
  // Используем цвета текста бейджей из Shipment Plan (условное форматирование)
  if (percentage < 75) return "#b91c1c"; // text-red-700
  if (percentage < 95) return "#ea580c"; // text-orange-600
  return "#15803d"; // text-green-700
};

export const MonthlyPlanCard: React.FC<MonthlyPlanCardProps> = ({
  title = "Monthly Plan",
  rows,
  onClick,
  formatFact,
  formatNumberK,
}) => {
  const { totalPlan, totalFact, totalPct } = useMemo(() => {
    const tp = rows.reduce((s, r) => s + (r.plan || 0), 0);
    const tf = rows.reduce((s, r) => s + (r.fact || 0), 0);
    const pct = tp > 0 ? Math.round((tf / tp) * 1000) / 10 : 0; // 1 decimal
    return { totalPlan: tp, totalFact: tf, totalPct: pct };
  }, [rows]);

  // Для определения цвета используем точное значение процента без округления
  const exactPercentage = totalPlan > 0 ? (totalFact / totalPlan) * 100 : 0;

  const totalBadge = getBadgeClasses(totalPct);

  const fmt = (n: number) => {
    if (formatNumberK) return formatNumberK(n);
    return formatFact(n);
  };

  return (
    <div
      className={`bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow ${
        onClick ? "cursor-pointer" : ""
      }`}
      onClick={onClick}
    >
      {/* Header */}
      <div className="bg-gray-50 px-6 py-3 rounded-t-xl border-b border-gray-200">
        <div className="flex items-center">
          <h3 className="text-base font-semibold text-gray-800 leading-none">{title}</h3>
        </div>
      </div>

      {/* Body */}
      <div className="px-6 pt-5 pb-4 tabular-nums">
        {/* Progress bar section */}
        <div className="space-y-4">
          {/* Main numbers */}
          <div className="text-center">
            <div className="text-[20px] font-bold text-[#0d1c3d] leading-none">
              {fmt(totalFact)} / {fmt(totalPlan)}
            </div>
          </div>

          {/* Progress bar */}
          <div className="relative">
            <div 
              className="w-full h-8 bg-gray-50 rounded-md overflow-hidden"
              style={{
                border: `2px solid ${getColorByPercentage(exactPercentage)}`,
              }}
            >
              <div
                className="h-full transition-all duration-1000 ease-out rounded-md"
                style={{
                  width: `${Math.min(totalPct, 100)}%`,
                  backgroundColor: getProgressBarColor(exactPercentage),
                }}
              />
            </div>
            {/* Progress percentage label on bar */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span 
                className="text-[12px] font-semibold"
                style={{ color: getProgressBarTextColor(exactPercentage) }}
              >
                {totalPct}%
              </span>
            </div>
          </div>
        </div>

        {/* Groups list */}
        <div className="mt-4">
          {/* Header with column titles */}
          <div className="px-6 py-3 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="text-[11.6px] font-semibold text-gray-500 uppercase tracking-wider leading-none">Group</div>
              </div>
              <div className="flex items-center gap-6">
                <div className="w-24 text-[11.6px] font-semibold text-gray-500 uppercase tracking-wider leading-none">Plan</div>
                <div className="w-24 text-[11.6px] font-semibold text-gray-500 uppercase tracking-wider leading-none">Fact</div>
                <div className="w-20 text-[11.6px] font-semibold text-gray-500 uppercase tracking-wider leading-none">%</div>
              </div>
            </div>
          </div>

          {/* Body with rows */}
          <div className="px-6 py-2 divide-y divide-gray-200 tabular-nums">
            {rows.map((r) => {
              const pct = r.percent ?? (r.plan > 0 ? Math.round((r.fact / r.plan) * 100) : 0);
              const circleColor = getColorByPercentage(pct);
              const pctRounded = Math.round(pct);

              return (
                <div 
                  key={r.group} 
                  className="flex items-center justify-between py-3 hover:bg-gray-50"
                >
                  <div className="flex-1 min-w-0 mr-4">
                    <div className="text-[13px] font-medium text-gray-900">
                      {r.group}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6">
                    <div className="w-24 text-[13px] text-gray-500 font-semibold">
                      {fmt(r.plan)}
                    </div>
                    
                    <div className="w-24 text-[13px] font-semibold text-[#0d1c3d]">
                      {fmt(r.fact)}
                    </div>

                    <div className="w-20">
                      <div className="flex items-center gap-2">
                        <Circle size={10} fill={circleColor} color={circleColor} />
                        <span className="text-[12px] text-gray-500 font-semibold">{pctRounded}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

