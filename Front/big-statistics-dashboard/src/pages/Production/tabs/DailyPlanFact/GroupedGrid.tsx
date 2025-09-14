import React, { useCallback, useRef, useEffect, useMemo, useState } from 'react';
import { AgGridReact } from '@ag-grid-community/react';
import type { ColDef, GridApi, ICellRendererParams, RowNode } from '@ag-grid-community/core';
import '@ag-grid-community/styles/ag-grid.css';
import '@ag-grid-community/styles/ag-theme-quartz.css';
import { ChevronRight, ChevronDown } from "lucide-react";

// Функция форматирования чисел
function formatNumber(value: any): string {
  if (value == null || value === '') return '–';
  const num = Number(value);
  if (isNaN(num)) return '–';
  return Math.round(num).toLocaleString('ru-RU').replace(/\s/g, '\u00A0');
}

// Функция форматирования процентов
function formatPercent(value: any): string {
  if (value == null || value === '') return '–';
  const num = Number(value);
  if (isNaN(num)) return '–';
  return Math.round(num).toLocaleString('ru-RU').replace(/\s/g, '\u00A0') + '%';
}

// Функция для расчета процента от итоговых значений
function calcPercentFromTotals(plan: number, fact: number): string {
  if ((!plan || plan === 0) && (!fact || fact === 0)) return '0%';
  if ((!plan || plan === 0) && fact > 0) return '100%';
  return Math.round((fact / plan) * 100) + '%';
}

// Функция форматирования даты в русский формат
function formatDate(dateString: any): string {
  if (!dateString || dateString === '') return '—';

  // Если дата уже в русском формате DD.MM.YYYY, возвращаем как есть
  if (typeof dateString === 'string' && /^\d{1,2}\.\d{1,2}\.\d{4}$/.test(dateString)) {
    return dateString;
  }

  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '—';

    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();

    return `${day}.${month}.${year}`;
  } catch (error) {
    return '—';
  }
}

// Рендерер для иерархических ячеек
const HierarchyCellRenderer: React.FC<ICellRendererParams & { expandedState?: any; onExpandedChange?: any }> = (params) => {
  const { data, node, expandedState, onExpandedChange } = params;
  if (!data || data._treeLevel == null) {
    return <span>{params.value || '—'}</span>;
  }

  const level = data._treeLevel;
  const key = data._treeKey;
  const paddings = [0, 18, 36, 54];
  const isLastLevel = level === 3;

  // Определяем, раскрыта ли группа
  let isExpanded = false;
  if (level === 0 && expandedState?.workshops?.includes(key)) {
    isExpanded = true;
  } else if (level === 1 && expandedState?.workCenters?.includes(key)) {
    isExpanded = true;
  } else if (level === 2 && expandedState?.dates?.includes(key)) {
    isExpanded = true;
  }

  const handleClick = () => {
    if (!isLastLevel && key && onExpandedChange) {
      const newState = { ...expandedState };

      if (level === 0) {
        const workshops = newState.workshops || [];
        if (workshops.includes(key)) {
          newState.workshops = workshops.filter((k: string) => k !== key);
        } else {
          newState.workshops = [...workshops, key];
        }
      } else if (level === 1) {
        const workCenters = newState.workCenters || [];
        if (workCenters.includes(key)) {
          newState.workCenters = workCenters.filter((k: string) => k !== key);
        } else {
          newState.workCenters = [...workCenters, key];
        }
      } else if (level === 2) {
        const dates = newState.dates || [];
        if (dates.includes(key)) {
          newState.dates = dates.filter((k: string) => k !== key);
        } else {
          newState.dates = [...dates, key];
        }
      }

      onExpandedChange(newState);
    }
  };

  return (
    <span
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        paddingLeft: paddings[level] || 0,
        cursor: isLastLevel ? 'default' : 'pointer'
      }}
      onClick={handleClick}
    >
      {!isLastLevel && (
        isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />
      )}
      {data.groupLabel || params.value || '—'}
    </span>
  );
};

// Рендерер для прогресс-баров с цветовой индикацией KPI
const ProgressCellRenderer: React.FC<ICellRendererParams> = (params) => {
  const value = params.value;
  if (!value || value === '–') {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center' }}>
        <span style={{ color: '#6b7280' }}>{value}</span>
      </div>
    );
  }

  const numericValue = parseFloat(String(value).replace('%', ''));
  const percentage = Math.min(Math.max(numericValue, 0), 100);

  // Цветовая логика как в KPI карточках - яркие цвета для обоих элементов
  let barColor = '#3b82f6'; // default blue
  let textColor = '#6b7280'; // default gray

  if (numericValue < 75) {
    // Красный - ниже 75%
    barColor = '#b91c1c'; // text-red-700 (яркий)
    textColor = '#b91c1c'; // text-red-700 (яркий)
  } else if (numericValue < 95) {
    // Оранжевый - 75% до 95%
    barColor = '#ea580c'; // text-orange-600 (яркий)
    textColor = '#ea580c'; // text-orange-600 (яркий)
  } else {
    // Зеленый - 95% и выше
    barColor = '#15803d'; // text-green-700 (яркий)
    textColor = '#15803d'; // text-green-700 (яркий)
  }

  return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      <div style={{ width: 80, background: '#e5e7eb', borderRadius: 9999, height: 12 }}>
        <div
          style={{
            width: `${percentage}%`,
            height: '100%',
            borderRadius: 9999,
            background: barColor,
            transition: 'width 300ms',
          }}
        />
      </div>
      <span
        className="text-sm font-medium"
        style={{ color: textColor }}
      >
        {Math.round(numericValue) + '%'}
      </span>
    </div>
  );
};

// Рендерер для числовых значений
const NumberCellRenderer: React.FC<ICellRendererParams & { isDifference?: boolean }> = (params) => {
  const { value, isDifference = false } = params;
  const numValue = Number(value);

  // Убираем цветовую индикацию для полей Differ - всегда серый цвет
  const color = '#6b7280'; // gray-500

  return <span style={{ color }}>{formatNumber(value)}</span>;
};

export type GroupedGridProps<T extends object = any> = {
  rowData: T[];
  columnDefs: ColDef<T>[];
  className?: string;
  defaultColDef?: ColDef<any> | any;
  bordered?: boolean;
  autoFit?: boolean;
  enableRangeSelection?: boolean;
  expandedState?: { workshops?: string[]; workCenters?: string[]; dates?: string[] };
  onExpandedChange?: (state: { workshops?: string[]; workCenters?: string[]; dates?: string[] }) => void;
  getRowId?: (params: any) => string;
  getRowStyle?: (params: any) => any;
  showTotalRow?: boolean; // Показывать итоговую строку
  t?: (key: string, options?: any) => string; // Функция перевода
};

/**
 * Компонент AGGrid с поддержкой иерархической группировки
 * Специально адаптирован для Daily Plan-Fact Overview
 */
const GroupedGrid = <T extends object = any,>({
  rowData,
  columnDefs,
  className,
  defaultColDef,
  bordered = false,
  autoFit = true,
  enableRangeSelection = true,
  expandedState = {},
  onExpandedChange,
  getRowId = (params) => {
    const d = params.data || {};
    return d.__id
      || (d._treeKey ? `${d._treeKey}##${d._treeLevel ?? 0}` : String(params.rowIndex));
  },
  getRowStyle,
  showTotalRow = false,
  t,
}: GroupedGridProps<T>) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<GridApi | null>(null);

  const refreshHeader = useCallback(() => {
    const api = apiRef.current;
    if (!api) return;
    try {
      api.refreshHeader();
    } catch {}
  }, []);

  const baseDefault: ColDef<any> = {
    resizable: true,
    sortable: false,
    filter: false,
    wrapHeaderText: true,
    autoHeaderHeight: true,
    minWidth: 90,
  };

  const columnLimits = (columnDefs || [])
    .map((c: any) => ({
      colId: (c.colId ?? c.field) as string,
      minWidth: c.minWidth ?? 90,
      maxWidth: c.maxWidth ?? 480,
    }))
    .filter(x => !!x.colId);

  const onGridReady = (p: any) => {
    apiRef.current = p.api;
  };

  const onFirstDataRendered = () => {
    // AG Grid с autoSizeStrategy="fitGridWidth" сам корректно подгонит ширины
  };

  // Обработчик изменения состояния раскрытия (не используется, логика в HierarchyCellRenderer)
  const onRowGroupOpened = (params: any) => {
    // Раскрытие/скрытие групп обрабатывается в HierarchyCellRenderer
    // Этот обработчик оставлен для совместимости с AGGrid
  };

  // Получаем идентификатор строки
  const getRowIdFunc = useCallback((params: any) => {
    return getRowId(params);
  }, [getRowId]);

  // Функция для определения стилей строк по умолчанию
  const defaultGetRowStyle = useCallback((params: any): any => {
    const d = params.data;
    if (!d) return {};

    // 1) Total (pinned) — всегда жирный и серый
    if (params.node?.rowPinned === 'bottom') {
      return { fontWeight: 700, backgroundColor: '#f3f4f6' };
    }

    // 2) Определяем, раскрыт ли соответствующий узел
    // ключи совпадают с теми, что вы формируете при построении дерева:
    //  - isWorkshopTotal:   _treeKey = workshop
    //  - isWorkCenterTotal: _treeKey = workshop||workCenter
    //  - isDateTotal:       _treeKey = workshop||workCenter||date
    const isWsExpanded  = expandedState?.workshops?.includes(d._treeKey);
    const isWcExpanded  = expandedState?.workCenters?.includes(d._treeKey);
    const isDtExpanded  = expandedState?.dates?.includes(d._treeKey);

    // 3) Стиль по уровням: подсвечиваем только раскрытые «шапки»
    if (d.isWorkshopTotal) {
      return isWsExpanded
        ? { fontWeight: 700, backgroundColor: '#f3f4f6', cursor: 'pointer' } // раскрыт — серый и жирный
        : { fontWeight: 400, backgroundColor: '#ffffff', cursor: 'pointer' }; // свернут — обычный на белом
    }

    if (d.isWorkCenterTotal) {
      return isWcExpanded
        ? { fontWeight: 600, backgroundColor: '#f9fafb', cursor: 'pointer' }
        : { fontWeight: 400, backgroundColor: '#ffffff', cursor: 'pointer' };
    }

    if (d.isDateTotal) {
      return isDtExpanded
        ? { fontWeight: 500, backgroundColor: '#f3f4f6', cursor: 'pointer' }
        : { fontWeight: 400, backgroundColor: '#ffffff', cursor: 'pointer' };
    }

    // 4) Детали — всегда белые, с тонкой границей сверху
    if (d.isDetail) {
      return { backgroundColor: '#ffffff', borderTop: '1px solid #e2e8f0' };
    }

    return {};
  }, [expandedState]);

  // Используем переданную функцию или функцию по умолчанию
  const getRowStyleFunc = useCallback((params: any): any => {
    if (getRowStyle) {
      return getRowStyle(params);
    }
    return defaultGetRowStyle(params);
  }, [getRowStyle, defaultGetRowStyle]);

  // Настраиваем авто-группировку для иерархических данных
  const autoGroupColumnDef: ColDef = useMemo(() => ({
    headerName: 'Work Shop',
    field: 'WorkShopName_CH',
    cellRenderer: HierarchyCellRenderer,
    minWidth: 200,
    cellStyle: { paddingLeft: '8px' },
    valueGetter: (params) => {
      // Возвращаем значение для группировки
      if (params.data) {
        return params.data.groupLabel || params.data.WorkShopName_CH;
      }
      return '';
    },
  }), []);

  // Расширяем определения колонок с кастомными рендерерами
  const enhancedColumnDefs: ColDef[] = useMemo(() => {
    return columnDefs.map(col => {
      const enhancedCol = { ...col };

      // Добавляем кастомные рендереры для специфических колонок
      switch (col.field) {
        case 'WorkShopName_CH':
          enhancedCol.cellRenderer = (params: ICellRendererParams) => {
            // Для pinned bottom row показываем переведенный текст "Total"
            if (params.node?.rowPinned === 'bottom') {
              const totalText = t ? t('tableTotal', { defaultValue: 'Total' }) : 'Total';
              return <span style={{ fontWeight: 700 }}>{totalText}</span>;
            }
            // Проверяем, что params.data существует
            if (!params.data) {
              return <span>—</span>;
            }
            return (
              <HierarchyCellRenderer
                {...params}
                expandedState={expandedState}
                onExpandedChange={onExpandedChange}
              />
            );
          };
          enhancedCol.valueGetter = (params: any) => {
            if (params.data) {
              return params.data.groupLabel || params.data.WorkShopName_CH;
            }
            return '';
          };
          break;
        case 'PercentQty':
        case 'PercentTime':
          enhancedCol.cellRenderer = (params: ICellRendererParams) => {
            const { data } = params;
            // Показываем прогресс-бар для итоговых строк и для Total (pinned)
            if (data?.isWorkshopTotal || data?.isWorkCenterTotal || data?.isDateTotal || params.node?.rowPinned === 'bottom') {
              return <ProgressCellRenderer {...params} />;
            }
            return <span style={{ color: '#6b7280', textAlign: 'center' }}>{formatPercent(params.value)}</span>;
          };
          // Добавляем центрирование для процентных колонок
          enhancedCol.cellStyle = { textAlign: 'center', ...(enhancedCol.cellStyle || {}) };
          break;
        case 'Plan_QTY':
        case 'FACT_QTY':
        case 'Plan_TIME':
        case 'FACT_TIME':
          enhancedCol.cellRenderer = NumberCellRenderer;
          // Добавляем центрирование для числовых колонок
          enhancedCol.cellStyle = { textAlign: 'center', ...(enhancedCol.cellStyle || {}) };
          break;
        case 'DifferQty':
        case 'DifferTime':
          enhancedCol.cellRenderer = (params: ICellRendererParams) => (
            <NumberCellRenderer {...params} isDifference={false} />
          );
          // Добавляем центрирование для числовых колонок
          enhancedCol.cellStyle = { textAlign: 'center', ...(enhancedCol.cellStyle || {}) };
          break;
        case 'ProductName_CN':
          enhancedCol.cellRenderer = (params: ICellRendererParams) => {
            // Для pinned строки показываем пустую строку
            if (params.node?.rowPinned === 'bottom') {
              return '';
            }
            const value = params.value;
            if (!value) return '—';
            // Ограничиваем до 34 символов и добавляем многоточие
            const truncatedValue = value.length > 34 ? value.substring(0, 34) + '...' : value;
            return (
              <span style={{ textAlign: 'left', display: 'block' }}>
                {truncatedValue}
              </span>
            );
          };
          break;
        case 'OrderNumber':
        case 'NomenclatureNumber':
          enhancedCol.cellRenderer = (params: ICellRendererParams) => {
            // Для pinned строки показываем пустую строку
            if (params.node?.rowPinned === 'bottom') {
              return '';
            }
            return params.value || '—';
          };
          break;
        default:
          // Для остальных колонок оставляем значения как есть
          enhancedCol.cellRenderer = (params: ICellRendererParams) => {
            return params.value || '—';
          };
      }

      return enhancedCol;
    });
  }, [columnDefs, expandedState, onExpandedChange, showTotalRow, t]);

  // Расчет итоговой строки для pinnedBottomRowData
  const pinnedTotalRow = useMemo(() => {
    if (!showTotalRow || !Array.isArray(rowData) || rowData.length === 0) return undefined;

    // Суммируем только итоговые по цеху (верхний уровень)
    const topRows = rowData.filter((r: any) => r?.isWorkshopTotal === true);

    // Если вдруг таких нет (защита), пробуем уровень 0
    const rows = topRows.length ? topRows : rowData.filter((r: any) => r?._treeLevel === 0);

    const sum = (f: string) => rows.reduce((acc: number, r: any) => acc + (Number(r?.[f]) || 0), 0);

    const planQty  = sum('Plan_QTY');
    const factQty  = sum('FACT_QTY');
    const planTime = sum('Plan_TIME');
    const factTime = sum('FACT_TIME');

    return {
      // Подпись выведем через рендерер, но поле нужно оставить
      WorkShopName_CH: 'Total',
      Plan_QTY: planQty,
      FACT_QTY: factQty,
      DifferQty: factQty - planQty,
      PercentQty: calcPercentFromTotals(planQty, factQty),
      Plan_TIME: planTime,
      FACT_TIME: factTime,
      DifferTime: factTime - planTime,
      PercentTime: calcPercentFromTotals(planTime, factTime),
      // Детальные поля (для совместимости с расширенными колонками)
      OrderNumber: '',
      NomenclatureNumber: '',
      ProductName_CN: '',
      // Служебные поля
      __id: '__pinned_total__',
    } as any;
  }, [rowData, showTotalRow, columnDefs]);

  useEffect(() => {
    if (!autoFit || !apiRef.current) return;
    // Мягкий рефреш колонок без автоSizeAllColumns
    refreshHeader();
  }, [autoFit, columnDefs, refreshHeader]);

  // При изменении набора колонок закрываем popup меню для предотвращения ошибок
  useEffect(() => {
    // при любом обновлении набора колонок аккуратно закрыть всплывающие меню,
    // чтобы MenuService не держал ссылку на уже удалённый header ctrl
    apiRef.current?.hidePopupMenu?.();
    // мягко обновим заголовок (защита в try уже есть)
    refreshHeader();
  }, [columnDefs, refreshHeader]);

  const wrapperStyle: React.CSSProperties = {
    width: '100%',
  };

  return (
    <div ref={wrapperRef} data-grid="grouped-grid" className={`ag-theme-quartz ${bordered ? 'ag-grid-bordered' : ''} ${className || ''}`} style={wrapperStyle}>
      <AgGridReact
        key={Array.isArray(enhancedColumnDefs) ? enhancedColumnDefs.map(c => (c as any).colId || (c as any).field).join('|') : 'grid'}
        rowData={rowData}
        columnDefs={enhancedColumnDefs}
        defaultColDef={{ ...(baseDefault as any), ...((defaultColDef as any) || {}) } as ColDef<any>}
        autoSizeStrategy={autoFit ? ({ type: 'fitGridWidth', defaultMinWidth: 90, columnLimits } as any) : undefined}

        onGridReady={onGridReady}
        onFirstDataRendered={onFirstDataRendered}
        onRowGroupOpened={onRowGroupOpened}

        // Стабильные идентификаторы для диффа данных
        getRowId={getRowIdFunc}

        // Стили строк
        getRowStyle={getRowStyleFunc}

        // Включаем выделение диапазона ячеек (Enterprise функция)
        rowSelection={enableRangeSelection ? 'multiple' : undefined}
        cellSelection={enableRangeSelection}
        suppressClipboardPaste={!enableRangeSelection}

        // Разрешаем копирование в буфер обмена
        sendToClipboard={enableRangeSelection ? (params: any) => {
          try {
            navigator.clipboard?.writeText?.(params.data);
          } catch {}
        } : undefined}

        // Отключаем анимации для лучшей производительности
        animateRows={false}
        suppressAggFuncInHeader={true}

        // Настройки для больших объемов данных
        rowBuffer={20}
        maxBlocksInCache={3}

        // Автоматический расчет высоты
        domLayout='autoHeight'

        // Прикалываем строку итога
        pinnedBottomRowData={showTotalRow && pinnedTotalRow ? [pinnedTotalRow] : undefined}
        
        // Добавляем контекст для отладки
        context={{ gridName: 'grouped-grid' }}
      />
    </div>
  );
};

export default GroupedGrid;
