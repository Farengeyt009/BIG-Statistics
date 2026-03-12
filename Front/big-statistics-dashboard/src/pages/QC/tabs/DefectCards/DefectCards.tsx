import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DateRangePickerPro } from '../../../../components/DatePicker';
import DefectCardsLog from './tabs/DefectCardsLog/DefectCardsLog';
import DefectCardsDashboard from './tabs/DefectCardsDashboard/DefectCardsDashboard';

const today = new Date();
const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

const DefectCards: React.FC = () => {
  const { t, i18n } = useTranslation('qc');
  const currentLanguage = i18n.language as 'en' | 'zh' | 'ru';

  const [activeTab, setActiveTab] = useState<'log' | 'dashboard'>('log');
  const [startDate, setStartDate] = useState<Date | null>(firstDayOfMonth);
  const [endDate, setEndDate] = useState<Date | null>(today);

  const handleDateRangeApply = (from: Date, to?: Date) => {
    setStartDate(from);
    setEndDate(to || from);
  };

  return (
    <div className="p-2 flex flex-col" style={{ minHeight: 0 }}>
      <div className="flex items-center gap-4 mb-3 flex-wrap flex-shrink-0">
        <div className="flex gap-2">
          <button
            className={`px-4 py-1 rounded-md text-sm font-medium border transition-colors ${
              activeTab === 'log'
                ? 'bg-[#0d1c3d] text-white border-[#0d1c3d]'
                : 'bg-gray-100 text-gray-700 border-gray-300'
            }`}
            onClick={() => setActiveTab('log')}
          >
            {t('defectCards.tabs.log')}
          </button>
          <button
            className={`px-4 py-1 rounded-md text-sm font-medium border transition-colors ${
              activeTab === 'dashboard'
                ? 'bg-[#0d1c3d] text-white border-[#0d1c3d]'
                : 'bg-gray-100 text-gray-700 border-gray-300'
            }`}
            onClick={() => setActiveTab('dashboard')}
          >
            {t('defectCards.tabs.dashboard')}
          </button>
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

        <div id="qc-defect-log-actions-slot" className="ml-auto flex items-center gap-2" />
      </div>

      {activeTab === 'log' && (
        <DefectCardsLog startDate={startDate} endDate={endDate} />
      )}

      {activeTab === 'dashboard' && (
        <DefectCardsDashboard startDate={startDate} endDate={endDate} />
      )}
    </div>
  );
};

export default DefectCards;
