import React from 'react';
import { createPortal } from 'react-dom';
import PlanVsFactTable from './PlanVsFactTable';
import PlanVsFactTableByGroup from './PlanVsFactTableByGroup';

interface Props {
  selectedYear: number | null;
  leadTimeMonths: number;
  onLeadTimeChange: (months: number) => void;
}

export default function PlanVsFact({ selectedYear, leadTimeMonths, onLeadTimeChange }: Props) {
  // Lead Time контрол для слота
  const leadTimeControl = (
    <div className="flex items-center gap-2">
      <label className="text-sm font-medium text-gray-700">
        Lead Time:
      </label>
      <input
        type="number"
        min="0"
        max="12"
        value={leadTimeMonths}
        onChange={(e) => {
          const val = parseInt(e.target.value) || 0;
          onLeadTimeChange(Math.max(0, Math.min(12, val)));
        }}
        className="w-16 px-2 py-1 border border-gray-300 rounded-md text-sm text-center"
      />
      <span className="text-xs text-gray-500">months</span>
    </div>
  );

  const leadTimeSlot = typeof document !== 'undefined' ? document.getElementById('saleplan-leadtime-slot') : null;

  return (
    <div className="flex flex-col">
      {/* Рендерим Lead Time в слот */}
      {leadTimeSlot && createPortal(leadTimeControl, leadTimeSlot)}

      {/* Первая таблица: группировка по Market */}
      <PlanVsFactTable selectedYear={selectedYear} leadTimeMonths={leadTimeMonths} />

      {/* Вторая таблица: группировка по LargeGroup */}
      <div className="mt-8">
        <PlanVsFactTableByGroup selectedYear={selectedYear} leadTimeMonths={leadTimeMonths} />
      </div>
    </div>
  );
}

