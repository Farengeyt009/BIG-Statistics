import React, { useState, useRef } from "react";
import MonthPlanGantt from "./MonthPlanGantt";
import MonthPlanSvod from "./MonthPlanSvod";

const MonthPlanTabs: React.FC = () => {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [activeTab, setActiveTab] = useState<'gantt' | 'svod'>('svod');
  const ymPanelRef = useRef<HTMLDivElement>(null);

  return (
    <div className="relative">
      <div ref={ymPanelRef} className="flex items-center gap-4 mb-2">
        {/* Внутренние вкладки */}
        <div className="flex gap-2">
          <button
            className={`px-4 py-1 rounded-md text-sm font-medium border transition-colors ${activeTab === 'svod' ? 'bg-[#0d1c3d] text-white border-[#0d1c3d]' : 'bg-gray-100 text-gray-700 border-gray-300'}`}
            onClick={() => setActiveTab('svod')}
          >
            Svod
          </button>
          <button
            className={`px-4 py-1 rounded-md text-sm font-medium border transition-colors ${activeTab === 'gantt' ? 'bg-[#0d1c3d] text-white border-[#0d1c3d]' : 'bg-gray-100 text-gray-700 border-gray-300'}`}
            onClick={() => setActiveTab('gantt')}
          >
            Gantt
          </button>
        </div>
        {/* Селекторы года и месяца */}
        <div className="flex gap-2">
          <select
            value={year}
            onChange={e => setYear(+e.target.value)}
            className="h-9 rounded-lg border-slate-300 shadow-sm px-3 focus:ring-2 focus:ring-indigo-600"
          >
            {Array.from({ length: 5 }, (_, i) => {
              const y = today.getFullYear() - 2 + i;
              return (
                <option key={y} value={y}>
                  {y}
                </option>
              );
            })}
          </select>
          <select
            value={month}
            onChange={e => setMonth(+e.target.value)}
            className="h-9 rounded-lg border-slate-300 shadow-sm px-3 focus:ring-2 focus:ring-indigo-600"
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {i + 1}
              </option>
            ))}
          </select>
        </div>
      </div>
      {activeTab === 'svod' && <MonthPlanSvod year={year} month={month} ymPanelRef={ymPanelRef} />}
      {activeTab === 'gantt' && <MonthPlanGantt year={year} month={month} ymPanelRef={ymPanelRef} />}
    </div>
  );
};

export default MonthPlanTabs; 