import { useState, useEffect } from 'react';
import { ContentLayout } from '../../../components/Layout';
import { useTranslation } from 'react-i18next';
import PlanVsFact from './PlanVsFact/PlanVsFact';
import Details from './Details/Details';
import YearPicker from '../../../components/DatePicker/YearPicker';
import { createPortal } from 'react-dom';

type SalePlanProps = {
  startDate: Date | null;
  endDate: Date | null;
  onChangeDates: (from: Date, to: Date) => void;
};

export default function SalePlan({ startDate, endDate, onChangeDates }: SalePlanProps) {
  const [activeSubtab, setActiveSubtab] = useState<'planvsfact' | 'details'>('planvsfact');
  const { t } = useTranslation('ordersTranslation');
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [leadTimeMonths, setLeadTimeMonths] = useState<number>(2);

  // Загрузка списка годов из API
  useEffect(() => {
    const loadYears = async () => {
      try {
        const response = await fetch('/api/orders/saleplan/versions');
        const data = await response.json();
        
        if (data.success) {
          const yearsSet = new Set<number>();
          data.versions.forEach((v: any) => {
            yearsSet.add(v.MinYear);
          });
          const years = Array.from(yearsSet).sort((a, b) => b - a);
          setAvailableYears(years);

          // Автоматический выбор года при загрузке
          if (years.length > 0) {
            const currentYear = new Date().getFullYear();

            // Приоритет 1: текущий год (если есть)
            if (years.includes(currentYear)) {
              setSelectedYear(currentYear);
            } 
            // Приоритет 2: текущий год + 1 (если есть)
            else if (years.includes(currentYear + 1)) {
              setSelectedYear(currentYear + 1);
            } 
            // Приоритет 3: ближайший к ТЕКУЩЕМУ году (не к +1)
            else {
              const closest = years.reduce((prev, curr) => {
                const prevDiff = Math.abs(prev - currentYear);
                const currDiff = Math.abs(curr - currentYear);
                return currDiff < prevDiff ? curr : prev;
              });
              setSelectedYear(closest);
            }
          }
        }
      } catch (err) {
        console.error('Ошибка загрузки годов:', err);
      }
    };

    loadYears();
  }, []);

  return (
    <ContentLayout>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-6">
          {/* Подвкладки */}
          <div className="flex gap-2">
            <button
              className={`px-4 py-1 rounded-md text-sm font-medium border transition-colors ${
                activeSubtab === 'planvsfact'
                  ? 'bg-[#0d1c3d] text-white border-[#0d1c3d]'
                  : 'bg-gray-100 text-gray-700 border-gray-300'
              }`}
              onClick={() => setActiveSubtab('planvsfact')}
            >
              Plan vs Fact
            </button>
            <button
              className={`px-4 py-1 rounded-md text-sm font-medium border transition-colors ${
                activeSubtab === 'details'
                  ? 'bg-[#0d1c3d] text-white border-[#0d1c3d]'
                  : 'bg-gray-100 text-gray-700 border-gray-300'
              }`}
              onClick={() => setActiveSubtab('details')}
            >
              Details
          </button>
        </div>

        {/* Year Picker */}
        <YearPicker
          selectedYear={selectedYear}
          onChange={setSelectedYear}
          availableYears={availableYears}
          placeholder="Все года"
        />

        {/* Lead Time (показывается только для Plan vs Fact) */}
        <div 
          id="saleplan-leadtime-slot" 
          className="flex items-center gap-2"
          style={{ display: activeSubtab === 'planvsfact' ? 'flex' : 'none' }}
        />
      </div>

        {/* Слот для иконок действий */}
        <div id="saleplan-actions-slot" className="flex items-center gap-2" />
      </div>

      {/* Контент подвкладок */}
      {activeSubtab === 'planvsfact' && (
        <PlanVsFact 
          selectedYear={selectedYear} 
          leadTimeMonths={leadTimeMonths}
          onLeadTimeChange={setLeadTimeMonths}
        />
      )}

      {activeSubtab === 'details' && (
        <Details selectedYear={selectedYear} />
      )}
    </ContentLayout>
  );
}

