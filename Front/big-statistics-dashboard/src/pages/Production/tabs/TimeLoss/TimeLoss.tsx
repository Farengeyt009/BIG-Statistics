import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DateRangePickerPro } from '../../../../components/DatePicker';
import Overview from './Overview';
import Table from './Table';

const TimeLoss: React.FC = () => {
  const { i18n, t } = useTranslation('production');
  const currentLanguage = i18n.language as 'en' | 'zh' | 'ru';
  const [activeTab, setActiveTab] = useState<'overview' | 'table'>('overview');
  // Инициализация последними 30 днями, включая сегодня
  const today = new Date();
  const start30 = new Date(today);
  start30.setDate(today.getDate() - 29);
  const [startDate, setStartDate] = useState<Date | null>(start30);
  const [endDate, setEndDate] = useState<Date | null>(today);

  const handleDateRangeApply = (from: Date, to?: Date) => {
    setStartDate(from);
    setEndDate(to || from);
    // Здесь можно добавить загрузку данных при изменении дат
    // loadTimeLossData(from, to || from);
  };

  // Получаем текущую дату для передачи в таблицу
  const currentDate = startDate ? startDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

  return (
    <div className="p-4">
      <div className="flex items-center gap-6 mb-4">
        {/* Внутренние вкладки */}
        <div className="flex gap-2">
          <button
            className={`px-4 py-1 rounded-md text-sm font-medium border transition-colors ${
              activeTab === 'overview' 
                ? 'bg-[#0d1c3d] text-white border-[#0d1c3d]' 
                : 'bg-gray-100 text-gray-700 border-gray-300'
            }`}
            onClick={() => setActiveTab('overview')}
          >
            {t('overview')}
          </button>
          <button
            className={`px-4 py-1 rounded-md text-sm font-medium border transition-colors ${
              activeTab === 'table' 
                ? 'bg-[#0d1c3d] text-white border-[#0d1c3d]' 
                : 'bg-gray-100 text-gray-700 border-gray-300'
            }`}
            onClick={() => setActiveTab('table')}
          >
            {t('table')}
          </button>
        </div>
        
        {/* Дата пикер */}
        <div className="flex items-center gap-2">
          <DateRangePickerPro
            mode="range"
            startDate={startDate}
            endDate={endDate}
            onApply={handleDateRangeApply}
            placeholder={t('selectDateRange')}
            className="w-64"
          />
        </div>

        {/* Слот для кнопок действий таблицы */}
        <div id="tl-actions-slot" className="ml-auto flex items-center gap-2" />
      </div>
      
      {/* Содержимое табов */}
      {activeTab === 'overview' && <Overview />}
      {activeTab === 'table' && <Table date={currentDate} />}
    </div>
  );
};

export default TimeLoss;
