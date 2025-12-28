import React, { useState, useEffect, useMemo, useRef, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { AgGridReact } from '@ag-grid-community/react';
import type { ColDef } from '@ag-grid-community/core';
import '@ag-grid-community/styles/ag-grid.css';
import '@ag-grid-community/styles/ag-theme-quartz.css';
import { useAuth } from '../../../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import LoadingSpinner from '../../../../components/ui/LoadingSpinner';
import ReportManager from './ReportManager';
import AgGridExportButton from '../../../../components/AgGrid/ExportButton';
import FocusModeToggle from '../../../../components/focus/FocusModeToggle';
import { applyStandardFilters, getMonthLabel, toIsoDate, BLANK_VALUE } from '../../../../components/AgGrid/filterUtils';

interface Report {
  report_id: number;
  report_name: string;
  is_template: boolean;
  can_edit: boolean;
  report_type: string;
}

interface OrdersLogTableProps {
  selectedReportId: number | null;
  setSelectedReportId: (id: number | null) => void;
  isManagerOpen: boolean;
  setIsManagerOpen: (open: boolean) => void;
}

const OrdersLogTable: React.FC<OrdersLogTableProps> = ({ 
  selectedReportId, 
  setSelectedReportId,
  isManagerOpen,
  setIsManagerOpen 
}) => {
  const { token } = useAuth();
  const { i18n } = useTranslation();
  const gridRef = useRef<AgGridReact>(null);
  const gridWrapperRef = useRef<HTMLDivElement | null>(null);
  
  // Состояния
  const [reports, setReports] = useState<Report[]>([]);
  const [rowData, setRowData] = useState<any[]>([]);
  const [columnDefs, setColumnDefs] = useState<ColDef[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadTrigger, setReloadTrigger] = useState(0);
  const [gridApi, setGridApi] = useState<any>(null);
  const [isReadyToShow, setIsReadyToShow] = useState(false);
  const renderTimeoutRef = useRef<number | null>(null);

  // После загрузки всех данных ждем завершения рендеринга
  useLayoutEffect(() => {
    if (loading) {
      setIsReadyToShow(false);
      if (renderTimeoutRef.current) {
        clearTimeout(renderTimeoutRef.current);
      }
      return;
    }

    if (renderTimeoutRef.current) {
      clearTimeout(renderTimeoutRef.current);
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        renderTimeoutRef.current = setTimeout(() => {
          setIsReadyToShow(true);
        }, 100);
      });
    });

    return () => {
      if (renderTimeoutRef.current) {
        clearTimeout(renderTimeoutRef.current);
      }
    };
  }, [loading]);
  const [gridHeightPx, setGridHeightPx] = useState<number | null>(null);

  // Функция загрузки списка отчетов
  const loadReports = async () => {
    try {
      const response = await fetch('/api/orders/reports/list', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await response.json();
      
      if (data.success) {
        setReports(data.reports);
        // Автоматически выбираем первый стандартный отчет (если еще не выбран)
        if (!selectedReportId) {
          const firstStandard = data.reports.find((r: Report) => r.is_template);
          if (firstStandard) {
            setSelectedReportId(firstStandard.report_id);
          }
        }
      }
    } catch (err) {
      console.error('Ошибка загрузки отчетов:', err);
    }
  };

  // Загрузка списка отчетов при монтировании
  useEffect(() => {
    if (token) {
      loadReports();
    }
  }, [token]);

  // Сбор значений для фильтра по дате, учитывая другие set-фильтры
  // Использует API для получения актуальных данных
  const createCollectDateValuesIgnoringSelf = useCallback((dateFields: Set<string>) => {
    return (params: any, colId: string) => {
      const api = params.api;
      const model = { ...(api.getFilterModel?.() ?? {}) } as Record<string, any>;
      delete model[colId];

      // Поддерживаем простые set-фильтры по другим колонкам (в т.ч. датам)
      const setFilters: Array<{ colId: string; allowed: Set<string> }> = [];
      for (const [k, m] of Object.entries(model)) {
        if ((m as any)?.filterType === 'set' && Array.isArray((m as any).values)) {
          setFilters.push({ colId: k, allowed: new Set((m as any).values as string[]) });
        }
      }

      const passOtherSetFilters = (row: any) => {
        for (const f of setFilters) {
          const v = dateFields.has(f.colId) ? toIsoDate(row?.[f.colId]) : String(row?.[f.colId] ?? '').trim();
          if (f.allowed.size && !f.allowed.has(v)) return false;
        }
        return true;
      };

      // Получаем данные через API для актуальности (все данные, не только отфильтрованные)
      const dataRows: any[] = [];
      api.forEachNode?.((node: any) => {
        if (node.data) dataRows.push(node.data);
      });

      const uniq = new Set<string>();
      let hasBlanks = false;
      dataRows.forEach((r) => {
        if (!passOtherSetFilters(r)) return;
        const iso = toIsoDate(r?.[colId]);
        if (iso) {
          uniq.add(iso);
        } else {
          // Отслеживаем наличие пустых значений
          hasBlanks = true;
        }
      });
      const out = Array.from(uniq);
      out.sort();
      // Добавляем специальное значение для blank в конец списка
      if (hasBlanks) {
        out.push(BLANK_VALUE);
      }
      params.success(out);
    };
  }, []);

  // Выполнение отчета при выборе или изменении
  useEffect(() => {
    const executeReport = async () => {
      if (!selectedReportId || !token) return;
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/orders/reports/${selectedReportId}/execute`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        const data = await response.json();

        if (data.success) {
          // Генерируем колонки на основе данных с форматированием
          if (data.columns && data.columns.length > 0) {
            // Определяем поля с датами (проверяем несколько строк, если первая пустая)
            const dateFields = new Set<string>();
            data.columns.forEach((colName: string) => {
              // Ищем первое непустое значение в данных для этого поля
              let value: any = null;
              for (const row of data.data || []) {
                value = row?.[colName];
                if (value != null && value !== '') break;
              }
              // Проверяем формат даты DD.MM.YYYY
              const isDate = typeof value === 'string' && /^\d{2}\.\d{2}\.\d{4}$/.test(value);
              if (isDate) dateFields.add(colName);
            });

            // Создаем функцию для сбора значений дат (использует API для актуальных данных)
            const collectDateValues = createCollectDateValuesIgnoringSelf(dateFields);

            const cols: ColDef[] = data.columns.map((colName: string) => {
              // Определяем тип данных по первой строке
              const firstValue = data.data?.[0]?.[colName];
              const isNumber = typeof firstValue === 'number';
              const isDate = dateFields.has(colName);
              
              return {
                field: colName,
                headerName: colName,
                filter: true,
                sortable: true,
                resizable: true,
                minWidth: 120,
                // Явно указываем cellDataType для правильного определения типа фильтра
                ...(isNumber && {
                  cellDataType: 'number',
                  // valueFormatter - только для ОТОБРАЖЕНИЯ (с пробелами)
                  valueFormatter: (params: any) => {
                    if (params.value == null) return '';
                    return params.value.toLocaleString('ru-RU');
                  },
                  cellClass: 'text-right',
                }),
                // Иерархический фильтр дат с группировкой по годам, месяцам, дням
                ...(isDate && {
                  cellClass: 'text-center',
                  filter: 'agSetColumnFilter', // Используем Set фильтр с treeList для иерархии
                  filterParams: {
                    treeList: true as any,
                    refreshValuesOnOpen: true,
                    values: (params: any) => collectDateValues(params, colName),
                    // treeListPathGetter, valueFormatter и filterValueGetter для blank
                    // будут автоматически добавлены в filterUtils.ts
                  },
                  // Для отображения оставляем строку как есть
                  valueFormatter: (params: any) => {
                    return params.value ? String(params.value) : '';
                  },
                }),
              };
            });
            
            // Применяем стандартные настройки фильтров (кнопки Apply/Clear/Reset)
            // Примечание: agSetColumnFilter не модифицируется утилитой, что правильно
            // Передаем language для локализации месяцев в фильтре дат
            const colsWithStandardFilters = applyStandardFilters(cols, { language: i18n?.language });
            setColumnDefs(colsWithStandardFilters);
          }
          
          setRowData(data.data || []);
        } else {
          setError(data.error || 'Ошибка выполнения отчета');
        }
      } catch (err) {
        setError('Ошибка соединения с сервером');
        console.error('Ошибка выполнения отчета:', err);
      } finally {
        setLoading(false);
      }
    };

    executeReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedReportId, reloadTrigger]);

  // Focus mode height: вычисляем доступную высоту когда body имеет класс 'app-focus'
  useLayoutEffect(() => {
    const compute = () => {
      const el = gridWrapperRef.current;
      if (!el) return;
      const isFocus = typeof document !== 'undefined' && document.body.classList.contains('app-focus');
      if (!isFocus) {
        setGridHeightPx(null);
        return;
      }
      const top = el.getBoundingClientRect().top;
      const h = Math.max(200, Math.floor(window.innerHeight - top - 8));
      setGridHeightPx(h);
    };
    compute();
    window.addEventListener('resize', compute);
    const observer = new MutationObserver(compute);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => {
      window.removeEventListener('resize', compute);
      observer.disconnect();
    };
  }, []);

  // Группировка отчетов
  const standardReports = useMemo(() => reports.filter(r => r.is_template), [reports]);
  const myReports = useMemo(() => reports.filter(r => !r.is_template), [reports]);

  const defaultColDef = useMemo<ColDef>(() => ({
    minWidth: 100,
    filter: true,
    sortable: true,
    resizable: true,
    editable: false,
    enableCellChangeFlash: false,
    suppressKeyboardEvent: (params) => {
      // Разрешаем Ctrl+C для копирования
      const event = params.event as KeyboardEvent;
      if (event.ctrlKey && event.key === 'c') {
        return false; // не подавляем
      }
      return false;
    },
  }), []);

  // Рендерим селектор и кнопку в слоты через Portal
  const selectorSlot = document.getElementById('orderlog-report-selector');
  const buttonSlot = document.getElementById('orderlog-manage-button');

  return (
    <div className="flex flex-col h-full">
      {/* Рендерим селектор отчета в слот через Portal */}
      {selectorSlot && createPortal(
        <>
          <label className="text-xs font-semibold text-gray-700">Report:</label>
          <select
            value={selectedReportId || ''}
            onChange={(e) => setSelectedReportId(Number(e.target.value))}
            className="px-3 py-1 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[200px]"
          >
            {standardReports.length > 0 && (
              <optgroup label="📊 Standard Reports">
                {standardReports.map(report => (
                  <option key={report.report_id} value={report.report_id}>
                    {report.report_name}
                  </option>
                ))}
              </optgroup>
            )}
            {myReports.length > 0 && (
              <optgroup label="👤 My Reports">
                {myReports.map(report => (
                  <option key={report.report_id} value={report.report_id}>
                    {report.report_name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          {!loading && rowData.length > 0 && (
            <div className="text-xs text-gray-600">
              Records: <span className="font-semibold">{rowData.length.toLocaleString('ru-RU')}</span>
            </div>
          )}
        </>,
        selectorSlot
      )}

      {/* Рендерим кнопки в слот через Portal */}
      {buttonSlot && createPortal(
        <div className="flex items-center gap-2">
          <AgGridExportButton api={gridApi} fileName="order_log" variant="icon" />
          <FocusModeToggle variant="dark" />
          <button
            className="h-8 w-8 p-2 rounded-md border border-gray-300 bg-white text-slate-700 hover:bg-gray-100 transition flex items-center justify-center"
            onClick={() => setIsManagerOpen(true)}
            title="Manage Reports"
            aria-label="Manage Reports"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>,
        buttonSlot
      )}

      {/* Сообщение об ошибке */}
      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {/* Таблица */}
      {(loading || !isReadyToShow) ? (
        <div className="relative" style={{ height: '600px' }}>
          <LoadingSpinner overlay="screen" size="xl" />
        </div>
      ) : (
        <div 
          ref={gridWrapperRef}
          className="ag-theme-quartz" 
          style={{ width: '100%', height: gridHeightPx != null ? `${gridHeightPx}px` : '78vh' }}
        >
          <AgGridReact
            ref={gridRef}
            rowData={rowData}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            onGridReady={(params) => setGridApi(params.api)}
            pagination={false}
            animateRows={false}
            rowSelection="multiple"
            cellSelection={true}
            suppressRowClickSelection={true}
            suppressDragLeaveHidesColumns={true}
            enableRangeSelection={true}
            enableRangeHandle={true}
            copyHeadersToClipboard={false}
            suppressCopyRowsToClipboard={false}
            processCellForClipboard={(params) => {
              // При копировании возвращаем чистое значение из data (без форматирования)
              const colId = params.column.getColId();
              const rawValue = params.node?.data?.[colId];
              
              // Для чисел возвращаем как есть (без пробелов)
              if (typeof rawValue === 'number') {
                return rawValue;
              }
              
              return rawValue ?? '';
            }}
            statusBar={{
              statusPanels: [{ statusPanel: 'agAggregationComponent', align: 'left' }],
            }}
          />
        </div>
      )}

      {/* Модальное окно управления отчетами */}
      <ReportManager
        isOpen={isManagerOpen}
        onClose={() => setIsManagerOpen(false)}
        onReportChanged={async (reportId) => {
          console.log('onReportChanged called with reportId:', reportId);
          
          // Перезагружаем список отчетов
          try {
            const response = await fetch('/api/orders/reports/list', {
              headers: {
                'Authorization': `Bearer ${token}`,
              },
            });
            const data = await response.json();
            
            if (data.success) {
              console.log('Reports reloaded, total:', data.reports.length);
              setReports(data.reports);
              
              // Выбираем отчет после обновления списка
              setTimeout(() => {
                if (reportId) {
                  console.log('Setting selectedReportId to:', reportId);
                  setSelectedReportId(reportId);
                  setReloadTrigger(prev => prev + 1); // Принудительная перезагрузка
                } else {
                  // Если reportId не передан (удаление) - выбираем первый стандартный
                  const firstStandard = data.reports.find((r: Report) => r.is_template);
                  if (firstStandard) {
                    console.log('Selecting first standard report:', firstStandard.report_id);
                    setSelectedReportId(firstStandard.report_id);
                    setReloadTrigger(prev => prev + 1);
                  }
                }
              }, 100);
            }
          } catch (err) {
            console.error('Ошибка перезагрузки отчетов:', err);
          }
        }}
      />
    </div>
  );
};

export default OrdersLogTable;

