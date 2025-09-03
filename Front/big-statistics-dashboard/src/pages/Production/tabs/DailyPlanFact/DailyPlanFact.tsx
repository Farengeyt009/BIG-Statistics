import React, { useState, useCallback } from 'react';
import { DateRangePickerPro } from '../../../../components/DatePicker';
import Overview from './Overview';
import Table from './Table';
import type { Table as TableType } from '@tanstack/react-table';
import ExportButton from '../../../../components/ExportButton';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';

// Форматирование локальной даты без сдвига часового пояса
const toYmdLocal = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const DailyPlanFact: React.FC = () => {
  const { i18n } = useTranslation();
  const currentLanguage = i18n.language as 'en' | 'zh' | 'ru';
  
  const [activeTab, setActiveTab] = useState<'overview' | 'table'>('overview');
  const [startDate, setStartDate] = useState<Date | null>(new Date());
  const [endDate, setEndDate] = useState<Date | null>(new Date());
  const [tableRef, setTableRef] = useState<TableType<any> | null>(null);
  const [data, setData] = useState<any[]>([]);

  // React Query: загрузка эффективности
  const { data: rqData, isLoading, isFetching, error } = useQuery({
    queryKey: ['efficiency', startDate ? toYmdLocal(startDate) : null, endDate ? toYmdLocal(endDate) : null],
    enabled: Boolean(startDate && endDate),
    queryFn: async ({ signal }) => {
      const startFormatted = toYmdLocal(startDate!);
      const endFormatted = toYmdLocal(endDate!);
      const response = await fetch(`/api/Production/Efficiency?start_date=${startFormatted}&end_date=${endFormatted}`, { signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      return result?.data || [];
    },
    keepPreviousData: true,
  });

  // синхронизируем локальное состояние таблиц с данными запроса (опционально)
  React.useEffect(() => {
    if (Array.isArray(rqData)) setData(rqData);
  }, [rqData]);

  const handleDateRangeApply = (from: Date, to?: Date) => {
    setStartDate(from);
    setEndDate(to || from);
  };

  // Отладочная информация
  React.useEffect(() => {
    console.log('TableRef updated:', tableRef);
  }, [tableRef]);

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
            Overview
          </button>
          <button
            className={`px-4 py-1 rounded-md text-sm font-medium border transition-colors ${
              activeTab === 'table' 
                ? 'bg-[#0d1c3d] text-white border-[#0d1c3d]' 
                : 'bg-gray-100 text-gray-700 border-gray-300'
            }`}
            onClick={() => setActiveTab('table')}
          >
            Table
          </button>
        </div>
        
        {/* Дата пикер - перемещен ближе к табам */}
        <div className="flex items-center gap-2">
          <DateRangePickerPro
            mode="range"
            startDate={startDate}
            endDate={endDate}
            onApply={handleDateRangeApply}
            locale={currentLanguage}
            placeholder="Select date range"
            className="w-64"
          />
        </div>
        
        {/* Кнопка экспорта справа */}
        <div className="ml-auto">
          {activeTab === 'table' && (
            <ExportButton 
              table={tableRef} 
              fileName="production_data.xlsx" 
            />
          )}
        </div>
      </div>
      {activeTab === 'overview' && <Overview data={data} loading={isLoading && !data.length} error={error ? String((error as any)?.message || error) : null} />}
      {activeTab === 'table' && <Table data={data} loading={isLoading && !data.length} error={error ? String((error as any)?.message || error) : null} onTableReady={setTableRef} />}
    </div>
  );
};

export default DailyPlanFact; 