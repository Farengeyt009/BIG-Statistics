import React, { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
import { AgGridReact } from '@ag-grid-community/react';
import type { ColDef } from '@ag-grid-community/core';
import '@ag-grid-community/styles/ag-grid.css';
import '@ag-grid-community/styles/ag-theme-quartz.css';
import { useAuth } from '../../../../context/AuthContext';
import LoadingSpinner from '../../../../components/ui/LoadingSpinner';
import { useTranslation } from 'react-i18next';
import AgGridGroupedExportButton from '../../../../components/AgGrid/GroupedExportButton';
import FocusModeToggle from '../../../../components/focus/FocusModeToggle';
import { FlagIcon } from '../../../../components/FlagIcon';

interface RawData {
  Market: string;
  LargeGroup: string;
  GroupName: string;
  AggregatedShipmentDate: string | null;
  RemainingToProduce_QTY: number;
}

interface ProcessedRow {
  Market: string;
  LargeGroup: string;
  GroupName: string;
  Total: number;
  no_date: number;
  [key: string]: any;
}

const GroupedProductionTableByGroup: React.FC = () => {
  const { token } = useAuth();
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

  // Загрузка данных
  useEffect(() => {
    if (!token) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/orders/statistics/grouped-table', {
          headers: { 'Authorization': `Bearer ${token}` },
        });

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
  }, [token]);

  // Обработка данных
  const { rowData, columnDefs, pinnedBottomRowData } = useMemo(() => {
    if (rawData.length === 0) {
      return { rowData: [], columnDefs: [] };
    }

    const currentYear = new Date().getFullYear();
    
    // 1. Собираем уникальные года
    const yearsSet = new Set<number>();
    rawData.forEach(row => {
      if (row.AggregatedShipmentDate) {
        const dateStr = String(row.AggregatedShipmentDate);
        let date: Date;
        
        if (dateStr.includes('.')) {
          const [day, month, year] = dateStr.split('.').map(Number);
          date = new Date(year, month - 1, day);
        } else {
          date = new Date(dateStr);
        }
        
        const year = date.getFullYear();
        if (!isNaN(year) && year > 1900 && year < 2100) {
          yearsSet.add(year);
        }
      }
    });

    const allYears = Array.from(yearsSet).sort((a, b) => a - b);

    // 2. Генерируем список колонок дат
    const dateColumns: Array<{ key: string; header: string }> = [];

    // Прошлые года
    allYears.filter(y => y < currentYear).forEach(year => {
      dateColumns.push({ key: `year_${year}`, header: `${year}` });
    });

    // Текущий год (12 месяцев)
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    for (let month = 0; month < 12; month++) {
      dateColumns.push({
        key: `month_${currentYear}_${month}`,
        header: t(`statisticsTable.months.${monthNames[month]}`),
      });
    }

    // Будущие года
    allYears.filter(y => y > currentYear).forEach(year => {
      dateColumns.push({ key: `year_${year}`, header: `${year}` });
    });

    // 3. Группируем данные (БЕЗ Market - только по LargeGroup|GroupName)
    const grouped: Record<string, ProcessedRow> = {};

    rawData.forEach(row => {
      const market = row.Market || 'Не указан';
      const largeGroup = row.LargeGroup || 'Не указано';
      const groupName = row.GroupName || 'Не указано';
      const qty = row.RemainingToProduce_QTY || 0;
      
      const key = `${largeGroup}|${groupName}`;  // БЕЗ market
      
      if (!grouped[key]) {
        grouped[key] = {
          Market: market,  // Сохраняем для полноты, но не группируем
          LargeGroup: largeGroup,
          GroupName: groupName,
          Total: 0,
          no_date: 0,
        };
        dateColumns.forEach(col => {
          grouped[key][col.key] = 0;
        });
      }

      // Распределяем по датам
      if (row.AggregatedShipmentDate) {
        const dateStr = String(row.AggregatedShipmentDate);
        let date: Date;
        
        if (dateStr.includes('.')) {
          const [day, month, year] = dateStr.split('.').map(Number);
          date = new Date(year, month - 1, day);
        } else {
          date = new Date(dateStr);
        }
        
        const year = date.getFullYear();
        const month = date.getMonth();

        if (!isNaN(year) && year > 1900 && year < 2100) {
          let targetColumn: string | null = null;

          if (year < currentYear) {
            targetColumn = `year_${year}`;
          } else if (year === currentYear) {
            targetColumn = `month_${currentYear}_${month}`;
          } else {
            targetColumn = `year_${year}`;
          }

          if (targetColumn && grouped[key][targetColumn] !== undefined) {
            grouped[key][targetColumn] += qty;
          }
        } else {
          grouped[key].no_date += qty;
        }
      } else {
        grouped[key].no_date += qty;
      }
    });

    // 4. Вычисляем Total
    Object.values(grouped).forEach(row => {
      row.Total = dateColumns.reduce((sum, col) => sum + (row[col.key] || 0), 0) + row.no_date;
    });

    // Сортируем строки по убыванию Total
    const processedRows = Object.values(grouped).sort((a, b) => (b.Total || 0) - (a.Total || 0));

    // 4.5. Создаем Grand Total строку
    const grandTotal: any = {
      Market: '',
      LargeGroup: 'TOTAL',
      GroupName: '',
      Total: 0,
      no_date: 0,
    };

    dateColumns.forEach(col => {
      grandTotal[col.key] = 0;
    });

    processedRows.forEach(row => {
      grandTotal.Total += row.Total || 0;
      grandTotal.no_date += row.no_date || 0;
      dateColumns.forEach(col => {
        grandTotal[col.key] += row[col.key] || 0;
      });
    });

    // 5. Генерируем колонки (БЕЗ Market)
    const cols: ColDef[] = [
      // LargeGroup - первый уровень группировки (скрыт)
      {
        field: 'LargeGroup',
        headerName: 'Large Group',
        rowGroup: true,
        hide: true,
      },
      // GroupName - обычное поле (не группируется), скрыто
      {
        field: 'GroupName',
        headerName: 'Group',
        rowGroup: false,
        hide: true,
      },
      {
        field: 'Total',
        headerName: t('statisticsTable.total'),
        minWidth: 95,
        aggFunc: 'sum',
        valueFormatter: (p: any) => (p.value == null || p.value === 0) ? '' : p.value.toLocaleString('ru-RU'),
        cellStyle: { fontWeight: 'bold', backgroundColor: '#f0f9ff' },
      },
      {
        field: 'no_date',
        headerName: t('statisticsTable.nonDate'),
        minWidth: 95,
        aggFunc: 'sum',
        valueFormatter: (p: any) => (p.value == null || p.value === 0) ? '' : p.value.toLocaleString('ru-RU'),
        cellStyle: { backgroundColor: '#fef3c7' },
      },
    ];

    // Добавляем колонки дат
    dateColumns.forEach(col => {
      cols.push({
        field: col.key,
        headerName: col.header,
        minWidth: 95,
        aggFunc: 'sum',
        valueFormatter: (p: any) => (p.value == null || p.value === 0) ? '' : p.value.toLocaleString('ru-RU'),
      });
    });

    return { 
      rowData: processedRows, 
      columnDefs: cols,
      pinnedBottomRowData: [grandTotal],
    };
  }, [rawData, t]);

  const defaultColDef = useMemo<ColDef>(() => ({
    resizable: true,
    sortable: false,
    filter: false,
  }), []);

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

  // AutoGroupColumn для отображения LargeGroup и GroupName
  const autoGroupColumnDef = useMemo<ColDef>(() => ({
    headerName: 'Group',
    minWidth: 250,
    cellRenderer: 'agGroupCellRenderer',
    cellRendererParams: {
      suppressCount: true,
      innerRenderer: (params: any) => {
        // Для итоговой строки (pinnedBottom)
        if (params.node?.rowPinned === 'bottom') {
          return <strong>{t('statisticsTable.totalRow')}</strong>;
        }

        // Для групповых строк (LargeGroup)
        if (params.node?.group) {
          return <span>{params.value}</span>;
        }
        
        // Для leaf-строк показываем GroupName
        return <span>{params.data?.GroupName ?? ''}</span>;
      },
    },
  }), [t]);

  return (
    <div ref={containerRef} className="flex flex-col">
      {/* Заголовок и кнопки на одном уровне */}
      <div className="flex items-end justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-[#0d1c3d] mb-2">
            Uncompleted Orders by Group
          </h3>
          <div style={{ color: '#6b7280', fontSize: 14, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {t('statisticsTable.canBeUngrouped')} {t('statisticsTable.group')} 
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ display: 'inline-block' }}>
              <path d="M6 4L10 8L6 12" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {t('statisticsTable.model')}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <AgGridGroupedExportButton api={gridApi} fileName="uncompleted_orders_by_group" variant="icon" />
          <FocusModeToggle variant="dark" />
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {(loading || !isReadyToShow) ? (
        <div className="relative" style={{ height: '600px' }}>
          <LoadingSpinner overlay="screen" size="xl" />
        </div>
      ) : (
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
      )}
    </div>
  );
};

export default GroupedProductionTableByGroup;
