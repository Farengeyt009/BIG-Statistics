import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { DateRangePickerPro } from '../../../../components/DatePicker';
import StampingWastes from './tabs/StampingWastes/StampingWastes';
import PlasticWastes from './tabs/PlasticWastes/PlasticWastes';
import WastesSummary from './tabs/WastesSummary/WastesSummary';

const today = new Date();
const thirtyDaysAgo = new Date(today);
thirtyDaysAgo.setDate(today.getDate() - 30);

const VALID_SUBTABS = ['summary', 'stamping', 'injection'];

const Wastes: React.FC = () => {
  const { t, i18n } = useTranslation('qc');
  const currentLanguage = i18n.language as 'en' | 'zh' | 'ru';
  const [searchParams] = useSearchParams();
  const subtabFromUrl = searchParams.get('subtab');

  const [activeTab, setActiveTab] = useState<'summary' | 'stamping' | 'injection'>(
    subtabFromUrl && VALID_SUBTABS.includes(subtabFromUrl)
      ? subtabFromUrl as 'summary' | 'stamping' | 'injection'
      : 'summary'
  );

  useEffect(() => {
    if (subtabFromUrl && VALID_SUBTABS.includes(subtabFromUrl)) {
      setActiveTab(subtabFromUrl as 'summary' | 'stamping' | 'injection');
    }
  }, [subtabFromUrl]);
  const [startDate, setStartDate] = useState<Date | null>(thirtyDaysAgo);
  const [endDate, setEndDate] = useState<Date | null>(today);

  const handleDateRangeApply = (from: Date, to?: Date) => {
    setStartDate(from);
    setEndDate(to || from);
  };

  const tabs: { key: 'summary' | 'stamping' | 'injection'; label: string }[] = [
    { key: 'summary',   label: t('wastes.tabs.summary') },
    { key: 'stamping',  label: t('wastes.tabs.stamping') },
    { key: 'injection', label: t('wastes.tabs.injection') },
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

        <div id="qc-wastes-stamping-actions-slot" className="ml-auto flex items-center gap-2" />
        <div id="qc-wastes-injection-actions-slot" className="flex items-center gap-2" />
      </div>

      {activeTab === 'summary' && (
        <WastesSummary startDate={startDate} endDate={endDate} />
      )}

      {activeTab === 'stamping' && (
        <StampingWastes startDate={startDate} endDate={endDate} />
      )}

      {activeTab === 'injection' && (
        <PlasticWastes startDate={startDate} endDate={endDate} />
      )}
    </div>
  );
};

export default Wastes;
