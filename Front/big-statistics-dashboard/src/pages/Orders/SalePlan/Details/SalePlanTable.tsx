import React, { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
import { AgGridReact } from '@ag-grid-community/react';
import type { ColDef } from '@ag-grid-community/core';
import '@ag-grid-community/styles/ag-grid.css';
import '@ag-grid-community/styles/ag-theme-quartz.css';
import LoadingSpinner from '../../../../components/ui/LoadingSpinner';
import { useTranslation } from 'react-i18next';
import { FlagIcon } from '../../../../components/FlagIcon';

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
  [key: string]: any; // month_0, month_1, ... month_11
}

interface Props {
  selectedYear: number | null;
}

const SalePlanTable: React.FC<Props> = ({ selectedYear }) => {
  const { t } = useTranslation('ordersTranslation');
  
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
    if (!selectedYear) {
      setRawData([]);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/orders/saleplan/year/${selectedYear}`);
        const result = await response.json();
        
        if (result.success) {
          setRawData(result.data || []);
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
  }, [selectedYear]);

  // Обработка данных
  const { rowData, columnDefs, pinnedBottomRowData } = useMemo(() => {
    if (rawData.length === 0 || !selectedYear) {
      return { rowData: [], columnDefs: [], pinnedBottomRowData: [] };
    }

    // Группируем данные по Market|LargeGroup
    const grouped: Record<string, ProcessedRow> = {};

    rawData.forEach(row => {
      // Нормализуем Market (trim + единый регистр для группировки)
      const marketRaw = (row.Market || 'Не указан').trim();
      const market = marketRaw; // Сохраняем исходный регистр для отображения
      const largeGroup = (row.LargeGroup || 'Не указано').trim();
      const monthIndex = row.MonthNum - 1; // 1-12 → 0-11
      const qty = row.QTY || 0;
      
      // Для ключа используем нормализованные значения (lowercase для сравнения)
      const key = `${marketRaw.toLowerCase()}|${largeGroup.toLowerCase()}`;
      
      if (!grouped[key]) {
        grouped[key] = {
          Market: market,
          LargeGroup: largeGroup,
        };
        // Инициализируем все месяцы нулями
        for (let m = 0; m < 12; m++) {
          grouped[key][`month_${m}`] = 0;
        }
      }

      // Добавляем QTY к соответствующему месяцу
      if (monthIndex >= 0 && monthIndex < 12) {
        grouped[key][`month_${monthIndex}`] += qty;
      }
    });

    // Вычисляем Total для каждой строки
    Object.values(grouped).forEach(row => {
      let total = 0;
      for (let m = 0; m < 12; m++) {
        total += row[`month_${m}`] || 0;
      }
      row.Total = total;
    });

    // Сортируем по убыванию Total
    const processedRows = Object.values(grouped).sort((a, b) => (b.Total || 0) - (a.Total || 0));

    // Grand Total строка
    const grandTotal: any = {
      Market: 'TOTAL',
      LargeGroup: '',
      Total: 0,
    };

    for (let m = 0; m < 12; m++) {
      grandTotal[`month_${m}`] = 0;
    }

    processedRows.forEach(row => {
      grandTotal.Total += row.Total || 0;
      for (let m = 0; m < 12; m++) {
        grandTotal[`month_${m}`] += row[`month_${m}`] || 0;
      }
    });

    // Генерируем колонки
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const cols: ColDef[] = [
      // Market - единственная группировка
      {
        field: 'Market',
        headerName: 'Market',
        rowGroup: true,
        hide: true,
      },
      // LargeGroup - обычное поле (не группируется), скрыто
      {
        field: 'LargeGroup',
        headerName: 'Large Group',
        rowGroup: false,
        hide: true,
      },
      // Total
      {
        field: 'Total',
        headerName: 'Total',
        minWidth: 95,
        aggFunc: 'sum',
        valueFormatter: (p: any) => {
          if (p.value == null || p.value === 0) return '';
          return Math.round(p.value).toLocaleString('ru-RU');
        },
        cellStyle: { fontWeight: 'bold', backgroundColor: '#f0f9ff' },
      },
    ];

    // Добавляем колонки месяцев
    for (let m = 0; m < 12; m++) {
      cols.push({
        field: `month_${m}`,
        headerName: t(`statisticsTable.months.${monthNames[m]}`),
        minWidth: 95,
        aggFunc: 'sum',
        valueFormatter: (p: any) => {
          if (p.value == null || p.value === 0) return '';
          return Math.round(p.value).toLocaleString('ru-RU');
        },
      });
    }

    return { 
      rowData: processedRows, 
      columnDefs: cols,
      pinnedBottomRowData: [grandTotal],
    };
  }, [rawData, selectedYear, t]);

  const defaultColDef = useMemo<ColDef>(() => ({
    resizable: true,
    sortable: false,
    filter: false,
  }), []);

  // AutoGroupColumn
  const autoGroupColumnDef = useMemo<ColDef>(() => ({
    headerName: 'Market',
    minWidth: 250,
    cellRenderer: 'agGroupCellRenderer',
    cellRendererParams: {
      suppressCount: true,
      innerRenderer: (params: any) => {
        if (params.node?.rowPinned === 'bottom') {
          return <strong>{t('statisticsTable.totalRow')}</strong>;
        }

        if (params.node?.group) {
          const level = params.node.level ?? 0;
          
          if (level === 0) {
            return (
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FlagIcon market={params.value} />
                <span>{params.value}</span>
              </span>
            );
          }
          
          return <span>{params.value}</span>;
        }
        
        return <span>{params.data?.LargeGroup ?? ''}</span>;
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
          Sale Plan by Market
        </h3>
        <div style={{ color: '#6b7280', fontSize: 14, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          Can be ungrouped: Market
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ display: 'inline-block' }}>
            <path d="M6 4L10 8L6 12" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Group
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

export default SalePlanTable;

