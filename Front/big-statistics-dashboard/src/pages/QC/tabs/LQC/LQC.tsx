import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { DateRangePickerPro } from '../../../../components/DatePicker';
import LQCLog from './tabs/LQCLog/LQCLog';
import LQCSummary from './tabs/LQCSummary/LQCSummary';

const today = new Date();
const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

const toYmdLocal = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const LQC: React.FC = () => {
  const { t, i18n } = useTranslation('qc');
  const currentLanguage = i18n.language as 'en' | 'zh' | 'ru';

  const [activeTab, setActiveTab] = useState<'log' | 'summary'>('log');
  const [startDate, setStartDate] = useState<Date | null>(firstDayOfMonth);
  const [endDate, setEndDate] = useState<Date | null>(today);

  const handleDateRangeApply = (from: Date, to?: Date) => {
    setStartDate(from);
    setEndDate(to || from);
  };

  const { data = [], isLoading, isFetching, error } = useQuery<any[]>({
    queryKey: ['qc-lqc-journal', startDate ? toYmdLocal(startDate) : null, endDate ? toYmdLocal(endDate) : null],
    enabled: Boolean(startDate && endDate),
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams();
      if (startDate) params.append('date_from', toYmdLocal(startDate));
      if (endDate)   params.append('date_to',   toYmdLocal(endDate));
      const response = await fetch(`/api/qc/lqc-journal?${params.toString()}`, { signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      return result?.data || [];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const showLoader = isLoading || isFetching;
  const errorMsg = error ? String((error as any)?.message || error) : null;

  const tabs: { key: 'log' | 'summary'; label: string }[] = [
    { key: 'log',     label: t('lqc.tabs.log') },
    { key: 'summary', label: t('lqc.tabs.summary') },
  ];

  return (
    <div className="p-2 flex flex-col" style={{ minHeight: 0 }}>
      <div className="flex items-center gap-4 mb-3 flex-wrap flex-shrink-0">
        <div className="flex gap-2">
          {tabs.map(tab => (
            <button
              key={tab.key}
              className={`px-4 py-1 rounded-md text-sm font-medium border transition-colors ${
                activeTab === tab.key
                  ? 'bg-[#0d1c3d] text-white border-[#0d1c3d]'
                  : 'bg-gray-100 text-gray-700 border-gray-300'
              }`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <DateRangePickerPro
          mode="range"
          startDate={startDate}
          endDate={endDate}
          onApply={handleDateRangeApply}
          locale={currentLanguage}
          placeholder="Select date range"
          className="w-64"
        />

        <div id="qc-lqc-log-actions-slot" className="ml-auto flex items-center gap-2" />
      </div>

      {activeTab === 'log' && (
        <LQCLog data={data} loading={showLoader} error={errorMsg} />
      )}

      {activeTab === 'summary' && (
        <LQCSummary data={data} loading={showLoader} error={errorMsg} />
      )}
    </div>
  );
};

export default LQC;
