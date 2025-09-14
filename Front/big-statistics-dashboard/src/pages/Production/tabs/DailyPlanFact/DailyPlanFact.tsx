import React, { useState, useCallback } from 'react';
import { DateRangePickerPro } from '../../../../components/DatePicker';
import Overview from './Overview';
import AgGridTable from './AgGridTable';
import LoadingSpinner from '../../../../components/ui/LoadingSpinner';
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
  const { i18n, t } = useTranslation('production');
  const currentLanguage = i18n.language as 'en' | 'zh' | 'ru';
  
  const [activeTab, setActiveTab] = useState<'overview' | 'table'>('overview');
  const [startDate, setStartDate] = useState<Date | null>(new Date());
  const [endDate, setEndDate] = useState<Date | null>(new Date());
  const [tableRef, setTableRef] = useState<any | null>(null);
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
    staleTime: 5 * 60 * 1000, // 5 минут
    gcTime: 10 * 60 * 1000, // 10 минут
    refetchOnWindowFocus: false, // НЕ перезагружать при фокусе окна
    refetchOnReconnect: false, // НЕ перезагружать при reconnect
  });

  // Глобальный лоадер для всех состояний загрузки
  const showGlobalLoader = isLoading || isFetching;

  // синхронизируем локальное состояние таблиц с данными запроса (опционально)
  React.useEffect(() => {
    if (Array.isArray(rqData)) setData(rqData);
  }, [rqData]);

  const handleDateRangeApply = (from: Date, to?: Date) => {
    setStartDate(from);
    setEndDate(to || from);
  };


  return (
    <div className="p-4 relative">
      {/* Глобальный оверлей */}
      {showGlobalLoader && (
        <div className="fixed inset-0 z-[1000] bg-white/60 backdrop-blur-sm
                        flex items-center justify-center">
          <LoadingSpinner size="xl" />
        </div>
      )}

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
            {t('overviewTab', 'Overview')}
          </button>
          <button
            className={`px-4 py-1 rounded-md text-sm font-medium border transition-colors ${
              activeTab === 'table'
                ? 'bg-[#0d1c3d] text-white border-[#0d1c3d]'
                : 'bg-gray-100 text-gray-700 border-gray-300'
            }`}
            onClick={() => setActiveTab('table')}
          >
            {t('tableTab', 'Table')}
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

        {/* Слот для иконок таблицы */}
        <div id="dpf-actions-slot" className="ml-auto flex items-center gap-2" />
      </div>
      {activeTab === 'overview' && (
        <Overview
          data={data}
          loading={isLoading && !data.length}
          error={error ? String((error as any)?.message || error) : null}
          suppressLocalLoaders={showGlobalLoader}
        />
      )}
      {activeTab === 'table' && (
        <AgGridTable
          data={data}
          loading={isLoading && !data.length}
          error={error ? String((error as any)?.message || error) : null}
          onTableReady={setTableRef}
          suppressLocalLoaders={showGlobalLoader}
        />
      )}
    </div>
  );
};

export default DailyPlanFact; 