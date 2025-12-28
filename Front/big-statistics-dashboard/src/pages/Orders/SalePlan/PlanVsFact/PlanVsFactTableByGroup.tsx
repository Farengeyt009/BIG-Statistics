import React, { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
import { AgGridReact } from '@ag-grid-community/react';
import type { ColDef, ColGroupDef } from '@ag-grid-community/core';
import '@ag-grid-community/styles/ag-grid.css';
import '@ag-grid-community/styles/ag-theme-quartz.css';
import LoadingSpinner from '../../../../components/ui/LoadingSpinner';
import { useTranslation } from 'react-i18next';
import { FlagIcon } from '../../../../components/FlagIcon';
import { useAuth } from '../../../../context/AuthContext';

interface RawData {
  YearNum: number;
  MonthNum: number;
  Market: string;
  LargeGroup: string;
  QTY: number;
}

interface ProcessedRow {
  Market: string;
  LargeGroup: string;
  total_plan: number;
  total_fact: number;
  total_diff: number;
  ytd_plan: number;
  ytd_fact: number;
  ytd_diff: number;
  [key: string]: any; // month_0_plan, month_0_fact, month_0_diff, ...
}

interface Props {
  selectedYear: number | null;
  leadTimeMonths: number;
}

const PlanVsFactTableByGroup: React.FC<Props> = ({ selectedYear, leadTimeMonths }) => {
  const { t } = useTranslation('ordersTranslation');
  const { token } = useAuth();
  
  const [rawData, setRawData] = useState<RawData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gridApi, setGridApi] = useState<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
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

  // Загрузка данных при изменении года
  useEffect(() => {
    if (!selectedYear || !token) {
      setRawData([]);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/orders/saleplan/planvsfact/${selectedYear}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const result = await response.json();
        
        if (result.success) {
          // Сохраняем план и факт отдельно для обработки
          setRawData({
            plan: result.plan || [],
            fact: result.fact || [],
          } as any);
        } else {
          setError(result.error || 'Ошибка загрузки данных');
        }
      } catch (err) {
        setError('Ошибка соединения с сервером');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedYear, token]);

  // Обработка данных
  const { rowData, columnDefs, pinnedBottomRowData } = useMemo(() => {
    if (!rawData || !selectedYear) {
      return { rowData: [], columnDefs: [], pinnedBottomRowData: [] };
    }

    const planData = (rawData as any).plan || [];
    const factData = (rawData as any).fact || [];

    // Объединяем план и факт в одну строку для каждой группы (обратный порядок)
    const grouped: Record<string, ProcessedRow> = {};
    
    // Обрабатываем план
    planData.forEach((row: any) => {
      const marketRaw = (row.Market || 'Не указан').trim();
      const largeGroup = (row.LargeGroup || 'Не указано').trim();
      const monthIndex = row.MonthNum - 1;
      const qty = row.PlannedQty || 0;
      
      const key = `${largeGroup.toLowerCase()}|${marketRaw.toLowerCase()}`;  // Обратный порядок
      
      if (!grouped[key]) {
        grouped[key] = {
          Market: marketRaw,
          LargeGroup: largeGroup,
          total_plan: 0,
          total_fact: 0,
          total_diff: 0,
        } as ProcessedRow;
        for (let m = 0; m < 12; m++) {
          grouped[key][`month_${m}_plan`] = 0;
          grouped[key][`month_${m}_fact`] = 0;
          grouped[key][`month_${m}_diff`] = 0;
        }
      }
      
      if (monthIndex >= 0 && monthIndex < 12) {
        grouped[key][`month_${monthIndex}_plan`] = qty;
      }
    });

    // Обрабатываем факт
    factData.forEach((row: any) => {
      const marketRaw = (row.Market || 'Не указан').trim();
      const largeGroup = (row.LargeGroup || 'Не указано').trim();
      const monthIndex = row.MonthNum - 1;
      const qty = row.ActualQty || 0;
      
      const key = `${largeGroup.toLowerCase()}|${marketRaw.toLowerCase()}`;  // Обратный порядок
      
      if (!grouped[key]) {
        grouped[key] = {
          Market: marketRaw,
          LargeGroup: largeGroup,
          total_plan: 0,
          total_fact: 0,
          total_diff: 0,
        } as ProcessedRow;
        for (let m = 0; m < 12; m++) {
          grouped[key][`month_${m}_plan`] = 0;
          grouped[key][`month_${m}_fact`] = 0;
          grouped[key][`month_${m}_diff`] = 0;
        }
      }
      
      if (monthIndex >= 0 && monthIndex < 12) {
        grouped[key][`month_${monthIndex}_fact`] = qty;
      }
    });

    const allRows = Object.values(grouped);

    // Вычисляем YTD, Different и Total для каждой строки
    allRows.forEach(row => {
      let totalPlan = 0, totalFact = 0;
      let ytdPlan = 0, ytdFact = 0;
      
      // Определяем до какого месяца считать YTD
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth(); // 0-11
      
      // Месяц + leadTimeMonths для выбранного года
      const targetDate = new Date(currentYear, currentMonth + leadTimeMonths, 1);
      const targetYear = targetDate.getFullYear();
      const targetMonth = targetDate.getMonth(); // 0-11
      
      for (let m = 0; m < 12; m++) {
        const plan = row[`month_${m}_plan`] || 0;
        const fact = row[`month_${m}_fact`] || 0;
        row[`month_${m}_diff`] = fact - plan;
        totalPlan += plan;
        totalFact += fact;
        
        // YTD: включаем месяц если год меньше или равен targetYear и месяц <= targetMonth
        const monthYear = selectedYear!;
        const shouldIncludeInYTD = 
          (monthYear < targetYear) || 
          (monthYear === targetYear && m <= targetMonth);
        
        if (shouldIncludeInYTD) {
          ytdPlan += plan;
          ytdFact += fact;
        }
      }
      
      row.total_plan = totalPlan;
      row.total_fact = totalFact;
      row.total_diff = totalFact - totalPlan;
      row.ytd_plan = ytdPlan;
      row.ytd_fact = ytdFact;
      row.ytd_diff = ytdFact - ytdPlan;
    });

    // Grand Total строка
    const grandTotal: any = {
      Market: 'TOTAL',
      LargeGroup: '',
      total_plan: 0,
      total_fact: 0,
      total_diff: 0,
      ytd_plan: 0,
      ytd_fact: 0,
      ytd_diff: 0,
    };

    for (let m = 0; m < 12; m++) {
      grandTotal[`month_${m}_plan`] = 0;
      grandTotal[`month_${m}_fact`] = 0;
      grandTotal[`month_${m}_diff`] = 0;
    }

    allRows.forEach(row => {
      grandTotal.total_plan += row.total_plan || 0;
      grandTotal.total_fact += row.total_fact || 0;
      grandTotal.total_diff += row.total_diff || 0;
      grandTotal.ytd_plan += row.ytd_plan || 0;
      grandTotal.ytd_fact += row.ytd_fact || 0;
      grandTotal.ytd_diff += row.ytd_diff || 0;
      
      for (let m = 0; m < 12; m++) {
        grandTotal[`month_${m}_plan`] += row[`month_${m}_plan`] || 0;
        grandTotal[`month_${m}_fact`] += row[`month_${m}_fact`] || 0;
        grandTotal[`month_${m}_diff`] += row[`month_${m}_diff`] || 0;
      }
    });

    // Генерируем колонки с группировкой
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const cols: (ColDef | ColGroupDef)[] = [
      // LargeGroup - единственная группировка
      {
        field: 'LargeGroup',
        headerName: 'Large Group',
        rowGroup: true,
        hide: true,
      },
      // Market - обычное поле, скрыто
      {
        field: 'Market',
        headerName: 'Market',
        rowGroup: false,
        hide: true,
      },
      // Группа Total (светло-серый фон)
      {
        headerName: 'Total',
        children: [
          {
            field: 'total_plan',
            headerName: 'Sales Plan',
            minWidth: 110,
            width: 110,
            aggFunc: 'sum',
            valueFormatter: (p: any) => (p.value == null || p.value === 0) ? '' : Math.round(p.value).toLocaleString('ru-RU'),
            cellStyle: { backgroundColor: '#f3f4f6' },
          },
          {
            field: 'total_fact',
            headerName: 'Order Fact',
            minWidth: 110,
            width: 110,
            aggFunc: 'sum',
            valueFormatter: (p: any) => (p.value == null || p.value === 0) ? '' : Math.round(p.value).toLocaleString('ru-RU'),
            cellStyle: { backgroundColor: '#f3f4f6' },
          },
          {
            field: 'total_diff',
            headerName: 'Diff',
            minWidth: 110,
            width: 110,
            aggFunc: 'sum',
            valueFormatter: (p: any) => {
              if (p.value == null || p.value === 0) return '';
              const val = Math.round(p.value);
              return val >= 0 ? `+${val.toLocaleString('ru-RU')}` : val.toLocaleString('ru-RU');
            },
            cellStyle: (p: any) => {
              const val = p.value ?? 0;
              return { 
                backgroundColor: '#f3f4f6',
                color: val >= 0 ? '#16a34a' : '#dc2626', 
                fontWeight: '500' 
              };
            },
          },
        ],
      },
      // Группа YTD (белый фон)
      {
        headerName: 'YTD',
        children: [
          {
            field: 'ytd_plan',
            headerName: 'Sales Plan',
            minWidth: 110,
            width: 110,
            aggFunc: 'sum',
            valueFormatter: (p: any) => (p.value == null || p.value === 0) ? '' : Math.round(p.value).toLocaleString('ru-RU'),
            cellStyle: { backgroundColor: '#ffffff' },
          },
          {
            field: 'ytd_fact',
            headerName: 'Order Fact',
            minWidth: 110,
            width: 110,
            aggFunc: 'sum',
            valueFormatter: (p: any) => (p.value == null || p.value === 0) ? '' : Math.round(p.value).toLocaleString('ru-RU'),
            cellStyle: { backgroundColor: '#ffffff' },
          },
          {
            field: 'ytd_diff',
            headerName: 'Diff',
            minWidth: 110,
            width: 110,
            aggFunc: 'sum',
            valueFormatter: (p: any) => {
              if (p.value == null || p.value === 0) return '';
              const val = Math.round(p.value);
              return val >= 0 ? `+${val.toLocaleString('ru-RU')}` : val.toLocaleString('ru-RU');
            },
            cellStyle: (p: any) => {
              const val = p.value ?? 0;
              return { 
                backgroundColor: '#ffffff',
                color: val >= 0 ? '#16a34a' : '#dc2626', 
                fontWeight: '500' 
              };
            },
          },
        ],
      },
    ];

    // Добавляем группы колонок для месяцев (чередование серый/белый)
    for (let m = 0; m < 12; m++) {
      // Чередование: Jan (серый), Feb (белый), Mar (серый)...
      const bgColor = m % 2 === 0 ? '#f3f4f6' : '#ffffff';
      
      cols.push({
        headerName: t(`statisticsTable.months.${monthNames[m]}`),
        children: [
          {
            field: `month_${m}_plan`,
            headerName: 'Sales Plan',
            minWidth: 110,
            width: 110,
            aggFunc: 'sum',
            valueFormatter: (p: any) => (p.value == null || p.value === 0) ? '' : Math.round(p.value).toLocaleString('ru-RU'),
            cellStyle: { backgroundColor: bgColor },
          },
          {
            field: `month_${m}_fact`,
            headerName: 'Order Fact',
            minWidth: 110,
            width: 110,
            aggFunc: 'sum',
            valueFormatter: (p: any) => (p.value == null || p.value === 0) ? '' : Math.round(p.value).toLocaleString('ru-RU'),
            cellStyle: { backgroundColor: bgColor },
          },
          {
            field: `month_${m}_diff`,
            headerName: 'Diff',
            minWidth: 110,
            width: 110,
            aggFunc: 'sum',
            valueFormatter: (p: any) => {
              if (p.value == null || p.value === 0) return '';
              const val = Math.round(p.value);
              return val >= 0 ? `+${val.toLocaleString('ru-RU')}` : val.toLocaleString('ru-RU');
            },
            cellStyle: (p: any) => {
              const val = p.value ?? 0;
              return { 
                backgroundColor: bgColor,
                color: val >= 0 ? '#16a34a' : '#dc2626', 
                fontWeight: '500' 
              };
            },
          },
        ],
      } as ColGroupDef);
    }

    // Сортируем по убыванию total_plan
    allRows.sort((a, b) => (b.total_plan || 0) - (a.total_plan || 0));

    return { 
      rowData: allRows, 
      columnDefs: cols,
      pinnedBottomRowData: [grandTotal],
    };
  }, [rawData, selectedYear, t]);

  const defaultColDef = useMemo<ColDef>(() => ({
    resizable: true,
    sortable: false,
    filter: false,
  }), []);

  // AutoGroupColumn для группировки по LargeGroup
  const autoGroupColumnDef = useMemo<ColDef>(() => ({
    headerName: 'Group',
    minWidth: 250,
    cellRenderer: 'agGroupCellRenderer',
    cellRendererParams: {
      suppressCount: true,
      innerRenderer: (params: any) => {
        if (params.node?.rowPinned === 'bottom') {
          return <strong>{t('statisticsTable.totalRow')}</strong>;
        }

        // Для групп (LargeGroup) - просто текст
        if (params.node?.group) {
          return <span>{params.value}</span>;
        }
        
        // Для leaf-строк показываем Market
        return <span>{params.data?.Market ?? ''}</span>;
      },
    },
  }), [t]);

  // Снятие выделения при клике вне таблицы
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        if (gridApi) {
          try {
            gridApi.clearRangeSelection?.();
            gridApi.deselectAll?.();
          } catch {}
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [gridApi]);

  if (!selectedYear) {
    return (
      <div className="p-8 text-center text-gray-500">
        Выберите год для просмотра плана продаж
      </div>
    );
  }

  if (loading || !isReadyToShow) {
    return (
      <div className="relative" style={{ height: '400px' }}>
        <LoadingSpinner overlay="screen" size="xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
        {error}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex flex-col">
      {/* Заголовок */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-[#0d1c3d] mb-2">
          Sale Plan vs Actual Orders by Group
        </h3>
        <div style={{ color: '#6b7280', fontSize: 14, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          Can be ungrouped: Group
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ display: 'inline-block' }}>
            <path d="M6 4L10 8L6 12" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Market
        </div>
      </div>

      <>
        <style>{`
          .ag-theme-quartz .ag-row {
            transition: none !important;
          }
          .ag-theme-quartz {
            --ag-row-animation-time: 0ms;
          }
          
          /* 1-й уровень (Total / Jan / Feb ...) */
          .ag-theme-quartz .ag-header-group-cell-label {
            display: flex !important;
            width: 100% !important;
            height: 100% !important;
            justify-content: center !important;
            align-items: center !important;
          }
          
          /* Текст внутри не тянет влево */
          .ag-theme-quartz .ag-header-group-cell-label .ag-header-group-text {
            width: auto !important;
            flex: 0 0 auto !important;
            text-align: center !important;
          }
          
          /* 2-й уровень (Plan / Fact / Diff) */
          .ag-theme-quartz .ag-header-cell-label {
            display: flex !important;
            width: 100% !important;
            justify-content: center !important;
            align-items: center !important;
          }
          
          /* Убираем padding с ячеек */
          .ag-theme-quartz .ag-header-group-cell {
            padding-left: 0 !important;
            padding-right: 0 !important;
          }
          
          /* Hover эффект с приоритетом над inline стилями */
          .ag-theme-quartz .ag-row:hover .ag-cell {
            background-color: rgba(59, 130, 246, 0.1) !important;
          }
          
          /* Hover для групповых строк */
          .ag-theme-quartz .ag-row-group:hover .ag-cell {
            background-color: rgba(59, 130, 246, 0.15) !important;
          }
        `}</style>
        <div className="ag-theme-quartz" style={{ width: '100%' }}>
          <AgGridReact
            rowData={rowData}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            autoGroupColumnDef={autoGroupColumnDef}
            pinnedBottomRowData={pinnedBottomRowData}
            domLayout="autoHeight"
            groupDisplayType="singleColumn"
            groupDefaultExpanded={0}
            suppressAggFuncInHeader={true}
            animateRows={false}
            suppressRowTransform={true}
            initialGroupOrderComparator={(params) => {
              const totalA = params.nodeA.aggData?.Total ?? 0;
              const totalB = params.nodeB.aggData?.Total ?? 0;
              return totalB - totalA;
            }}
            onGridReady={(params) => {
              setGridApi(params.api);
              setTimeout(() => {
                try { params.api.sizeColumnsToFit(); } catch {}
              }, 100);
            }}
            onFirstDataRendered={(params) => {
              try { params.api.sizeColumnsToFit(); } catch {}
            }}
            cellSelection={true}
            enableRangeSelection={true}
            enableRangeHandle={true}
            suppressRowClickSelection={true}
            copyHeadersToClipboard={false}
            processCellForClipboard={(params) => {
              const value = params.value;
              return typeof value === 'number' ? value : (value ?? '');
            }}
          />
        </div>
      </>
    </div>
  );
};

export default PlanVsFactTableByGroup;

