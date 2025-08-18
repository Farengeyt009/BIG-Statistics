import React, { useState, useEffect, useCallback } from 'react';
import { DateRangePickerPro } from '../../../../components/DatePicker';
import Overview from './Overview';
import Table from './Table';
import type { Table as TableType } from '@tanstack/react-table';
import ExportButton from '../../../../components/ExportButton';
import { useTranslation } from 'react-i18next';

const DailyPlanFact: React.FC = () => {
  const { i18n } = useTranslation();
  const currentLanguage = i18n.language as 'en' | 'zh' | 'ru';
  
  const [activeTab, setActiveTab] = useState<'overview' | 'table'>('overview');
  const [startDate, setStartDate] = useState<Date | null>(new Date());
  const [endDate, setEndDate] = useState<Date | null>(new Date());
  const [tableRef, setTableRef] = useState<TableType<any> | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Функция загрузки данных
  const fetchData = useCallback(async (start: Date | null, end: Date | null) => {
    if (!start || !end) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Форматируем даты для API
      const startFormatted = start.toISOString().split('T')[0];
      const endFormatted = end.toISOString().split('T')[0];
      
      const response = await fetch(`/api/Production/Efficiency?start_date=${startFormatted}&end_date=${endFormatted}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      setData(result.data || []);
    } catch (err) {
      console.error('Ошибка загрузки данных:', err);
      setError(err instanceof Error ? err.message : 'Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDateRangeApply = (from: Date, to?: Date) => {
    setStartDate(from);
    setEndDate(to || from);
  };

  // Отладочная информация
  useEffect(() => {
    console.log('TableRef updated:', tableRef);
  }, [tableRef]);

  // Загрузка данных при изменении дат
  useEffect(() => {
    fetchData(startDate, endDate);
  }, [startDate, endDate, fetchData]);

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
      {activeTab === 'overview' && <Overview data={data} loading={loading} error={error} />}
      {activeTab === 'table' && <Table data={data} loading={loading} error={error} onTableReady={setTableRef} />}
    </div>
  );
};

export default DailyPlanFact; 