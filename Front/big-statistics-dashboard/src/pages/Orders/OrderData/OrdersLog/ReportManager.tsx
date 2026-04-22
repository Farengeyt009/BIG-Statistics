import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../../context/AuthContext';
import { fetchJsonGetDedup } from '../../../../utils/fetchDedup';

interface Field {
  name: string;
  type: string;
}

interface Report {
  report_id: number;
  report_name: string;
  is_template: boolean;
  can_edit: boolean;
  selected_fields: string[];
  filters: Array<{ field: string; operator: string; value: any }>;
  grouping?: {
    group_by: string[];
    aggregates: Array<{ field: string; function: string; alias: string }>;
  };
}

interface ReportManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onReportChanged: (reportId?: number) => void;
}

const ReportManager: React.FC<ReportManagerProps> = ({ isOpen, onClose, onReportChanged }) => {
  const { token, user } = useAuth();
  const { t } = useTranslation('ordersTranslation');
  
  // Состояния
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [availableFields, setAvailableFields] = useState<Field[]>([]);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  
  // Данные формы
  const [reportName, setReportName] = useState('');
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [filters, setFilters] = useState<Array<{ field: string; operator: string; value: any }>>([]);
  const [groupBy, setGroupBy] = useState<string[]>([]);
  const [aggregates, setAggregates] = useState<Array<{ field: string; function: string; alias: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'fields' | 'filters' | 'grouping'>('fields');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [standardReportsExpanded, setStandardReportsExpanded] = useState(true);
  const [myReportsExpanded, setMyReportsExpanded] = useState(true);

  // Загрузка отчетов и полей
  useEffect(() => {
    if (!isOpen || !token) return;

    const loadData = async () => {
      try {
        // Загружаем отчеты
        const reportsData = await fetchJsonGetDedup<any>(
          '/api/orders/reports/list',
          token,
          1200
        );
        
        if (reportsData.success) {
          setReports(reportsData.reports);
        }

        // Загружаем доступные поля
        const fieldsResponse = await fetch('/api/orders/reports/fields?source_table=Orders.Orders_1C_Svod', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        const fieldsData = await fieldsResponse.json();
        
        if (fieldsData.success) {
          setAvailableFields(fieldsData.fields);
        }
      } catch (err) {
        console.error('Ошибка загрузки данных:', err);
      }
    };

    loadData();
  }, [isOpen, token]);

  // При выборе отчета - загружаем его данные
  const handleSelectReport = async (report: Report) => {
    setSelectedReport(report);
    setIsCreatingNew(false);
    setActiveTab('fields');
    
    try {
      const response = await fetch(`/api/orders/reports/${report.report_id}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      
      if (data.success) {
        setReportName(data.report.report_name);
        setSelectedFields(data.report.selected_fields || []);
        setFilters(data.report.filters || []);
        setGroupBy(data.report.grouping?.group_by || []);
        setAggregates(data.report.grouping?.aggregates || []);
      }
    } catch (err) {
      console.error('Ошибка загрузки отчета:', err);
    }
  };

  // Создание нового отчета
  const handleCreateNew = () => {
    setIsCreatingNew(true);
    setSelectedReport(null);
    setReportName('');
    setSelectedFields([]);
    setFilters([]);
    setGroupBy([]);
    setAggregates([]);
    setActiveTab('fields');
  };

  // Сохранение (создание или обновление)
  const handleSave = async () => {
    if (!reportName.trim()) {
      setError(t('reportManager.errors.enterName'));
      return;
    }

    if (selectedFields.length === 0) {
      setError(t('reportManager.errors.selectField'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const url = isCreatingNew 
        ? '/api/orders/reports/create'
        : `/api/orders/reports/${selectedReport?.report_id}`;
      
      const method = isCreatingNew ? 'POST' : 'PUT';

      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          report_name: reportName,
          source_table: 'Orders.Orders_1C_Svod',
          selected_fields: selectedFields,
          filters: filters,
          grouping: groupBy.length > 0 ? { group_by: groupBy, aggregates: aggregates } : null,
        }),
      });

      const data = await response.json();

      if (data.success) {
        const savedReportId = data.report?.report_id || selectedReport?.report_id;
        
        console.log('Report saved successfully, ID:', savedReportId);
        
        setIsCreatingNew(false);
        setSelectedReport(null);
        setReportName('');
        setSelectedFields([]);
        setFilters([]);
        setGroupBy([]);
        setAggregates([]);
        setActiveTab('fields');
        
        // Закрываем модалку и обновляем данные с ID сохраненного отчета
        onClose();
        onReportChanged(savedReportId);
      } else {
        setError(data.error || t('reportManager.errors.saveFailed'));
      }
    } catch (err) {
      setError(t('reportManager.errors.connectionError'));
    } finally {
      setLoading(false);
    }
  };

  // Удаление отчета
  const handleDelete = async () => {
    if (!selectedReport || !selectedReport.can_edit) return;
    
    const confirmDelete = window.confirm(
      t('reportManager.confirmDelete', { name: selectedReport.report_name })
    );
    
    if (!confirmDelete) return;

    try {
      const response = await fetch(`/api/orders/reports/${selectedReport.report_id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const data = await response.json();

      if (data.success) {
        setSelectedReport(null);
        setReportName('');
        setSelectedFields([]);
        setFilters([]);
        setGroupBy([]);
        setAggregates([]);
        setActiveTab('fields');
        
        // Закрываем модалку и обновляем данные
        onClose();
        onReportChanged();
      } else {
        setError(data.error || t('reportManager.errors.deleteFailed'));
      }
    } catch (err) {
      setError(t('reportManager.errors.connectionError'));
    }
  };

  // Функции работы с полями
  const handleFieldToggle = (fieldName: string) => {
    setSelectedFields(prev => {
      const newFields = prev.includes(fieldName)
        ? prev.filter(f => f !== fieldName)
        : [...prev, fieldName];
      
      // Если поле убрано из Fields - удаляем его из Group By
      if (!newFields.includes(fieldName)) {
        setGroupBy(prevGroupBy => prevGroupBy.filter(f => f !== fieldName));
        // Удаляем из агрегатов если это поле было там
        setAggregates(prevAgg => prevAgg.filter(a => a.field !== fieldName));
      }
      
      return newFields;
    });
  };

  // Drag and Drop обработчики
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newFields = [...selectedFields];
    const draggedField = newFields[draggedIndex];
    
    // Удаляем из старой позиции
    newFields.splice(draggedIndex, 1);
    // Вставляем в новую позицию
    newFields.splice(index, 0, draggedField);
    
    setSelectedFields(newFields);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  // Функции работы с фильтрами
  const handleAddFilter = (fieldName: string) => {
    setFilters(prev => [
      ...prev,
      { field: fieldName, operator: 'equals', value: '' }
    ]);
  };

  const handleRemoveFilter = (index: number) => {
    setFilters(prev => prev.filter((_, i) => i !== index));
  };

  const handleFilterChange = (index: number, operator: string, value: any) => {
    setFilters(prev => prev.map((filter, i) => 
      i === index ? { ...filter, operator, value } : filter
    ));
  };

  const handleCopyFiltersFromStandard = () => {
    const stdReport = reports.find(r => r.is_template);
    if (!stdReport || !stdReport.filters?.length) return;
    setFilters([...stdReport.filters]);
  };

  if (!isOpen) return null;

  const standardReports = reports.filter(r => r.is_template);
  const myReports = reports.filter(r => !r.is_template);
  const showRightPanel = selectedReport || isCreatingNew;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-[90vw] max-w-[1200px] h-[85vh] overflow-hidden flex flex-col">
        {/* Заголовок */}
        <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-blue-50 to-white">
          <h2 className="text-2xl font-bold text-[#142143]">Report Manager</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Контент: две панели */}
        <div className="flex flex-1 overflow-hidden">
          {/* ЛЕВАЯ ПАНЕЛЬ: Список отчетов */}
          <div className="w-80 border-r flex flex-col bg-gray-50">
            {/* Кнопка создания нового */}
            <div className="p-4 border-b bg-white">
              <button
                onClick={handleCreateNew}
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create New Report
              </button>
            </div>

            {/* Список отчетов */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {/* Стандартные отчеты */}
              {standardReports.length > 0 && (
                <div>
                  <button
                    onClick={() => setStandardReportsExpanded(!standardReportsExpanded)}
                    className="w-full flex items-center justify-between text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 hover:text-gray-700 transition"
                  >
                    <span>📊 Standard Reports ({standardReports.length})</span>
                    <svg 
                      className={`w-4 h-4 transition-transform ${standardReportsExpanded ? 'rotate-180' : ''}`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {standardReportsExpanded && (
                    <div className="space-y-2">
                      {standardReports.map(report => (
                      <div
                        key={report.report_id}
                        onClick={() => handleSelectReport(report)}
                        className={`p-3 rounded-lg border cursor-pointer transition ${
                          selectedReport?.report_id === report.report_id
                            ? 'bg-blue-100 border-blue-300 shadow-sm'
                            : 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-sm'
                        }`}
                      >
                        <div className="font-medium text-gray-800">{report.report_name}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {report.selected_fields?.length || 0} {t('reportManager.fields')}
                        </div>
                      </div>
                    ))}
                    </div>
                  )}
                </div>
              )}

              {/* Мои отчеты */}
              {myReports.length > 0 && (
                <div className="mt-4">
                  <button
                    onClick={() => setMyReportsExpanded(!myReportsExpanded)}
                    className="w-full flex items-center justify-between text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 hover:text-gray-700 transition"
                  >
                    <span>👤 My Reports ({myReports.length})</span>
                    <svg 
                      className={`w-4 h-4 transition-transform ${myReportsExpanded ? 'rotate-180' : ''}`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {myReportsExpanded && (
                    <div className="space-y-2">
                      {myReports.map(report => (
                      <div
                        key={report.report_id}
                        onClick={() => handleSelectReport(report)}
                        className={`p-3 rounded-lg border cursor-pointer transition ${
                          selectedReport?.report_id === report.report_id
                            ? 'bg-green-100 border-green-300 shadow-sm'
                            : 'bg-white border-gray-200 hover:border-green-300 hover:shadow-sm'
                        }`}
                      >
                        <div className="font-medium text-gray-800">{report.report_name}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {report.selected_fields?.length || 0} {t('reportManager.fields')}
                          {(report.filters?.length || 0) > 0 && 
                            ` • ${report.filters.length} ${t('reportManager.filtersCount')}`
                          }
                        </div>
                      </div>
                    ))}
                    </div>
                  )}
                </div>
              )}

              {/* Сообщение о создании нового */}
              {isCreatingNew && (
                <div className="mt-4">
                  <div className="p-3 rounded-lg border border-dashed border-blue-300 bg-blue-50">
                    <div className="font-medium text-blue-800">➕ {t('reportManager.newReport')}</div>
                    <div className="text-xs text-blue-600 mt-1">{t('reportManager.fillParams')}</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ПРАВАЯ ПАНЕЛЬ: Параметры отчета */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {showRightPanel ? (
              <>
                {/* Сообщение об ошибке */}
                {error && (
                  <div className="m-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg">
                    {error}
                  </div>
                )}

                {/* Параметры отчета */}
                <div className="flex-1 overflow-y-auto">
                  {/* Название отчета (всегда видно) */}
                  <div className="p-6 pb-4 border-b">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Report Name *
                    </label>
                    <input
                      type="text"
                      value={reportName}
                      onChange={(e) => setReportName(e.target.value)}
                      placeholder="e.g., My China Orders"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={!!(selectedReport && !selectedReport.can_edit && !user?.is_admin)}
                    />
                  </div>

                  {/* Вкладки */}
                  <div className="border-b">
                    <div className="flex gap-2 px-6 pt-4">
                      <button
                        onClick={() => setActiveTab('fields')}
                        className={`px-4 py-2 font-medium text-sm border-b-2 transition ${
                          activeTab === 'fields'
                            ? 'border-blue-600 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        📋 Fields ({selectedFields.length})
                      </button>
                      <button
                        onClick={() => setActiveTab('filters')}
                        className={`px-4 py-2 font-medium text-sm border-b-2 transition ${
                          activeTab === 'filters'
                            ? 'border-blue-600 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        🔍 Filters ({filters.length})
                      </button>
                      <button
                        onClick={() => setActiveTab('grouping')}
                        className={`px-4 py-2 font-medium text-sm border-b-2 transition ${
                          activeTab === 'grouping'
                            ? 'border-blue-600 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        📊 Grouping ({groupBy.length + aggregates.length})
                      </button>
                    </div>
                  </div>

                  {/* Контент вкладок */}
                  <div className="p-6">
                    {/* Вкладка: Выбор полей */}
                    {activeTab === 'fields' && (
                      <div>
                    <div className="grid grid-cols-2 gap-4">
                      {/* Левая панель: Доступные поля */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-3">
                          Available Fields
                        </label>
                        <div className="border border-gray-200 rounded-lg p-3 max-h-96 overflow-y-auto bg-gray-50">
                          {availableFields
                            .filter(field => !selectedFields.includes(field.name))
                            .map(field => (
                              <div
                                key={field.name}
                                onClick={() => {
                                  if (!(selectedReport && !selectedReport.can_edit && !user?.is_admin)) {
                                    handleFieldToggle(field.name);
                                  }
                                }}
                                className="p-2 hover:bg-blue-50 rounded cursor-pointer text-sm text-gray-700 border-b border-gray-100 last:border-0"
                              >
                                + {field.name}
                              </div>
                            ))}
                        </div>
                      </div>

                      {/* Правая панель: Выбранные поля (с порядком) */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-3">
                          Selected Fields ({selectedFields.length}) - Order in Table
                        </label>
                        <div className="border border-gray-200 rounded-lg p-3 max-h-96 overflow-y-auto bg-white">
                          {selectedFields.length === 0 ? (
                            <div className="text-center py-8 text-gray-400">
                              <p className="text-sm">No fields selected</p>
                              <p className="text-xs mt-1">Click fields on the left to add</p>
                            </div>
                          ) : (
                            selectedFields.map((fieldName, index) => (
                              <div
                                key={fieldName}
                                draggable={!(selectedReport && !selectedReport.can_edit && !user?.is_admin)}
                                onDragStart={() => handleDragStart(index)}
                                onDragOver={(e) => handleDragOver(e, index)}
                                onDragEnd={handleDragEnd}
                                className={`flex items-center gap-2 p-2 rounded mb-2 border transition ${
                                  draggedIndex === index 
                                    ? 'bg-blue-100 border-blue-400 shadow-lg scale-105' 
                                    : 'bg-gray-50 border-gray-200'
                                } ${!(selectedReport && !selectedReport.can_edit && !user?.is_admin) ? 'cursor-move' : ''}`}
                              >
                                {/* Иконка drag */}
                                {!(selectedReport && !selectedReport.can_edit && !user?.is_admin) && (
                                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                                  </svg>
                                )}
                                <span className="text-xs text-gray-500 font-mono w-6">{index + 1}.</span>
                                <span className="flex-1 text-sm text-gray-700">{fieldName}</span>
                                
                                {/* Кнопки управления */}
                                {!(selectedReport && !selectedReport.can_edit && !user?.is_admin) && (
                                  <div className="flex gap-1">
                                    {/* Кнопка вверх */}
                                    <button
                                      onClick={() => {
                                        if (index > 0) {
                                          const newFields = [...selectedFields];
                                          [newFields[index - 1], newFields[index]] = [newFields[index], newFields[index - 1]];
                                          setSelectedFields(newFields);
                                        }
                                      }}
                                      disabled={index === 0}
                                      className="p-1 text-blue-600 hover:bg-blue-50 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                                      title="Move up"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                      </svg>
                                    </button>
                                    
                                    {/* Кнопка вниз */}
                                    <button
                                      onClick={() => {
                                        if (index < selectedFields.length - 1) {
                                          const newFields = [...selectedFields];
                                          [newFields[index], newFields[index + 1]] = [newFields[index + 1], newFields[index]];
                                          setSelectedFields(newFields);
                                        }
                                      }}
                                      disabled={index === selectedFields.length - 1}
                                      className="p-1 text-blue-600 hover:bg-blue-50 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                                      title="Move down"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                      </svg>
                                    </button>
                                    
                                    {/* Кнопка удаления */}
                                    <button
                                      onClick={() => handleFieldToggle(fieldName)}
                                      className="p-1 text-red-600 hover:bg-red-50 rounded"
                                      title="Remove"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Подсказка */}
                    <p className="text-xs text-gray-500 mt-4">
                      💡 Tip: Drag fields to reorder or use ↑↓ buttons. Field order = column order in table.
                    </p>
                  </div>
                    )}

                    {/* Вкладка: Фильтры */}
                    {activeTab === 'filters' && (
                      <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="block text-sm font-semibold text-gray-700">
                        Filters (optional) - {filters.length} active
                      </label>
                      {(isCreatingNew || selectedReport?.can_edit || user?.is_admin) &&
                        reports.some(r => r.is_template && r.filters?.length > 0) && (
                        <button
                          onClick={handleCopyFiltersFromStandard}
                          title={t('filtersModal.copyFromAllOrders')}
                          className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-blue-400 bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium transition"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          {t('filtersModal.copyFromAllOrders')}
                        </button>
                      )}
                    </div>

                    {/* Список активных фильтров */}
                    {filters.length > 0 && (
                      <div className="space-y-3 mb-4">
                        {filters.map((filter, index) => (
                          <div key={index} className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg border border-gray-200">
                            <span className="text-sm font-medium text-gray-700 min-w-[150px]">{filter.field}</span>
                            
                            <select
                              value={filter.operator}
                              onChange={(e) => handleFilterChange(index, e.target.value, filter.value)}
                              className="px-3 py-1 border border-gray-300 rounded text-sm"
                              disabled={!!(selectedReport && !selectedReport.can_edit && !user?.is_admin)}
                            >
                              <option value="equals">=</option>
                              <option value="not_equals">≠</option>
                              <option value="greater_than">&gt;</option>
                              <option value="less_than">&lt;</option>
                              <option value="greater_or_equal">≥</option>
                              <option value="less_or_equal">≤</option>
                              <option value="contains">Contains</option>
                              <option value="not_contains">Not Contains</option>
                              <option value="starts_with">Starts With</option>
                              <option value="not_starts_with">Does not start with</option>
                              <option value="ends_with">Ends With</option>
                              <option value="is_null">Is Empty</option>
                              <option value="is_not_null">Not Empty</option>
                            </select>

                            {filter.operator !== 'is_null' && filter.operator !== 'is_not_null' && (
                              <input
                                type="text"
                                value={filter.value}
                                onChange={(e) => handleFilterChange(index, filter.operator, e.target.value)}
                                placeholder="Value"
                                className="flex-1 px-3 py-1 border border-gray-300 rounded text-sm"
                                disabled={!!(selectedReport && !selectedReport.can_edit && !user?.is_admin)}
                              />
                            )}

                            {(isCreatingNew || selectedReport?.can_edit || user?.is_admin) && (
                              <button
                                onClick={() => handleRemoveFilter(index)}
                                className="p-1 text-red-600 hover:bg-red-50 rounded transition"
                                title="Remove filter"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Добавление фильтра */}
                    {(isCreatingNew || selectedReport?.can_edit || user?.is_admin) && (
                      <div>
                        <select
                          onChange={(e) => {
                            if (e.target.value) {
                              handleAddFilter(e.target.value);
                              e.target.value = '';
                            }
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          defaultValue=""
                        >
                          <option value="" disabled>+ Add filter for field...</option>
                          {availableFields.map(field => (
                            <option key={field.name} value={field.name}>
                              {field.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                    )}

                    {/* Вкладка: Группировка */}
                    {activeTab === 'grouping' && (
                      <div className="space-y-6">
                        {/* Проверка что выбраны поля */}
                        {selectedFields.length === 0 ? (
                          <div className="text-center py-12">
                            <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            <p className="text-gray-500 font-medium">No fields selected</p>
                            <p className="text-sm text-gray-400 mt-2">
                              Please select fields in the "📋 Fields" tab first
                            </p>
                            <button
                              onClick={() => setActiveTab('fields')}
                              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                            >
                              Go to Fields
                            </button>
                          </div>
                        ) : (
                          <>
                            {/* GROUP BY поля */}
                            <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-3">
                                Group By Fields ({groupBy.length} selected)
                              </label>
                              <div className="border border-gray-200 rounded-lg p-4 max-h-48 overflow-y-auto">
                                {availableFields
                                  .filter(field => selectedFields.includes(field.name))
                                  .map(field => (
                                    <label
                                      key={field.name}
                                      className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={groupBy.includes(field.name)}
                                        onChange={() => {
                                          setGroupBy(prev =>
                                            prev.includes(field.name)
                                              ? prev.filter(f => f !== field.name)
                                              : [...prev, field.name]
                                          );
                                        }}
                                        disabled={!!(selectedReport && !selectedReport.can_edit && !user?.is_admin)}
                                        className="w-4 h-4 text-blue-600 rounded"
                                      />
                                      <span className="text-sm text-gray-700">{field.name}</span>
                                    </label>
                                  ))}
                              </div>
                              <p className="text-xs text-gray-500 mt-2">
                                💡 Only fields selected in "📋 Fields" tab are shown here
                              </p>
                            </div>

                            {/* Агрегатные функции */}
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-3">
                            Aggregate Functions ({aggregates.length})
                          </label>
                          
                          {/* Список агрегатов */}
                          {aggregates.length > 0 && (
                            <div className="space-y-2 mb-4">
                              {aggregates.map((agg, index) => (
                                <div key={index} className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg border border-gray-200">
                                  <select
                                    value={agg.function}
                                    onChange={(e) => {
                                      setAggregates(prev => prev.map((a, i) =>
                                        i === index ? { ...a, function: e.target.value } : a
                                      ));
                                    }}
                                    className="px-3 py-1 border border-gray-300 rounded text-sm w-32"
                                    disabled={!!(selectedReport && !selectedReport.can_edit && !user?.is_admin)}
                                  >
                                    <option value="SUM">SUM</option>
                                    <option value="COUNT">COUNT</option>
                                    <option value="AVG">AVG</option>
                                    <option value="MIN">MIN</option>
                                    <option value="MAX">MAX</option>
                                  </select>

                                  <span className="text-sm text-gray-600">(</span>

                                  <select
                                    value={agg.field}
                                    onChange={(e) => {
                                      setAggregates(prev => prev.map((a, i) =>
                                        i === index ? { ...a, field: e.target.value } : a
                                      ));
                                    }}
                                    className="flex-1 px-3 py-1 border border-gray-300 rounded text-sm"
                                    disabled={!!(selectedReport && !selectedReport.can_edit && !user?.is_admin)}
                                  >
                                    <option value="*">* (all rows)</option>
                                    {availableFields
                                      .filter(field => selectedFields.includes(field.name))
                                      .map(field => (
                                        <option key={field.name} value={field.name}>
                                          {field.name}
                                        </option>
                                      ))}
                                  </select>

                                  <span className="text-sm text-gray-600">)</span>
                                  <span className="text-sm text-gray-600">AS</span>

                                  <input
                                    type="text"
                                    value={agg.alias}
                                    onChange={(e) => {
                                      setAggregates(prev => prev.map((a, i) =>
                                        i === index ? { ...a, alias: e.target.value } : a
                                      ));
                                    }}
                                    placeholder="Column name"
                                    className="w-40 px-3 py-1 border border-gray-300 rounded text-sm"
                                    disabled={!!(selectedReport && !selectedReport.can_edit && !user?.is_admin)}
                                  />

                                  {(isCreatingNew || selectedReport?.can_edit || user?.is_admin) && (
                                    <button
                                      onClick={() => {
                                        setAggregates(prev => prev.filter((_, i) => i !== index));
                                      }}
                                      className="p-1 text-red-600 hover:bg-red-50 rounded transition"
                                      title="Remove"
                                    >
                                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Добавление агрегата */}
                          {(isCreatingNew || selectedReport?.can_edit || user?.is_admin) && (
                            <button
                              onClick={() => {
                                setAggregates(prev => [
                                  ...prev,
                                  { field: 'Total_Order_QTY', function: 'SUM', alias: 'Total_QTY' }
                                ]);
                              }}
                              className="w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-400 hover:text-blue-600 transition"
                            >
                              + Add Aggregate Function
                            </button>
                          )}

                          <p className="text-xs text-gray-500 mt-2">
                            💡 Example: SUM(Total_Order_QTY) AS Total_Quantity
                          </p>
                        </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Футер с кнопками */}
                <div className="border-t bg-gray-50 p-4 flex items-center justify-between">
                  <div>
                    {selectedReport && !selectedReport.is_template && (selectedReport.can_edit || user?.is_admin) && !isCreatingNew && (
                      <button
                        onClick={handleDelete}
                        className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition font-medium"
                      >
                        Delete Report
                      </button>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={onClose}
                      className="px-6 py-2 border border-gray-300 rounded-lg font-semibold hover:bg-gray-100 transition"
                    >
                      Close
                    </button>
                    {(isCreatingNew || selectedReport?.can_edit || user?.is_admin) && (
                      <button
                        onClick={handleSave}
                        disabled={loading}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50"
                      >
                        {loading ? 'Saving...' : (isCreatingNew ? 'Create Report' : 'Save Changes')}
                      </button>
                    )}
                  </div>
                </div>
              </>
            ) : (
              /* Пустое состояние */
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center text-gray-400">
                  <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-lg font-medium">Select a report</p>
                  <p className="text-sm mt-1">or create a new one</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportManager;

