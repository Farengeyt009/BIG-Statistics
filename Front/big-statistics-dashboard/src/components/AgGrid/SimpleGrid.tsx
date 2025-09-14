import React, { useCallback, useEffect, useRef, useMemo } from 'react';
import { AgGridReact } from '@ag-grid-community/react';
import type { ColDef, GridApi } from '@ag-grid-community/core';
import '@ag-grid-community/styles/ag-grid.css';
import '@ag-grid-community/styles/ag-theme-quartz.css';

export type SimpleGridProps<T extends object = any> = {
  rowData: T[];
  columnDefs: ColDef<T>[];
  pinnedTopRowData?: T[]; // сводные строки вверху
  className?: string;
  height?: number | string; // px or css value
  defaultColDef?: ColDef<any> | any;
  bordered?: boolean; // включает видимые линии сетки
  autoFit?: boolean; // автоматически подгоняет ширину колонок под контейнер
  enableRangeSelection?: boolean; // разрешить выделение диапазона ячеек
  /** 👉 опциональное имя для логов */
  gridName?: string;
};

/**
 * Простой компонент-обёртка над AgGridReact.
 * Использование:
 * <SimpleGrid rowData={rows} columnDefs={[{field:'name'}, {field:'value'}]} />
 */
const SimpleGrid = <T extends object = any,>({
  rowData,
  columnDefs,
  pinnedTopRowData,
  className,
  height = '560px',
  defaultColDef,
  bordered = false,
  autoFit = true,
  enableRangeSelection = true,
  gridName,
}: SimpleGridProps<T>) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<GridApi | null>(null);

  // Имя грида: из пропса или из ближайшего [data-grid] в дереве
  const name = useMemo(() => {
    const fromDom =
      wrapperRef.current?.closest('[data-grid]')?.getAttribute('data-grid') || '';
    return gridName || fromDom || 'unknown-grid';
  }, [gridName]);

  // Безопасные колонки: фильтруем битые и гарантируем colId
  const safeCols = useMemo<ColDef<any>[]>(() => {
    return (columnDefs ?? [])
      .filter((c: any) => !!c && (c.field || c.colId))
      .map((c, i) => ({ colId: c.colId ?? c.field ?? `c_${i}`, ...c }));
  }, [columnDefs]);

  const columnLimits = useMemo(
    () =>
      safeCols.map((c: any) => ({
        colId: (c.colId ?? c.field) as string,
        minWidth: c.minWidth ?? 90,
        maxWidth: c.maxWidth ?? 480,
      })),
    [safeCols]
  );

  const refreshHeader = useCallback(() => {
    const api = apiRef.current;
    if (!api) return;
    try {
      api.refreshHeader();
    } catch (e) {
      console.warn(`[SimpleGrid:${name}] refreshHeader failed`, e);
    }
  }, [name]);

  const baseDefault: ColDef<any> = {
    resizable: true,
    sortable: false,
    filter: false,
    wrapHeaderText: true,
    autoHeaderHeight: true,
    minWidth: 90,
  };

  const onGridReady = (p: any) => {
    apiRef.current = p.api;
    // пометим DOM-узел для дебага
    try {
      wrapperRef.current
        ?.querySelector('.ag-root-wrapper')
        ?.setAttribute('data-grid-name', name);
      console.debug(`[SimpleGrid:${name}] onGridReady, cols=${safeCols.length}`);
    } catch {}
  };

  const onFirstDataRendered = () => {
    // AG Grid с autoSizeStrategy="fitGridWidth" сам корректно подгонит ширины
  };

  // Мягкий рефреш заголовков только когда есть валидные колонки
  useEffect(() => {
    if (!autoFit || !apiRef.current || safeCols.length === 0) return;
    const id = requestAnimationFrame(refreshHeader);
    return () => cancelAnimationFrame(id);
  }, [autoFit, safeCols.length, refreshHeader]);

  const wrapperStyle: React.CSSProperties = {
    width: '100%',
    height: typeof height === 'number' ? `${height}px` : height,
  };

  // 👉 Ранний выход: не монтируем AG Grid, пока нет валидных колонок
  if (safeCols.length === 0) {
    console.debug(`[SimpleGrid:${name}] skip mount (no columns yet)`);
    return (
      <div
        ref={wrapperRef}
        className={`ag-theme-quartz ${bordered ? 'ag-grid-bordered' : ''} ${className || ''}`}
        style={wrapperStyle}
      />
    );
  }

  return (
    <div
      ref={wrapperRef}
      className={`ag-theme-quartz ${bordered ? 'ag-grid-bordered' : ''} ${className || ''}`}
      style={wrapperStyle}
    >
      <AgGridReact<any>
        rowData={rowData}
        pinnedTopRowData={pinnedTopRowData}
        columnDefs={safeCols}
        defaultColDef={{ ...(baseDefault as any), ...((defaultColDef as any) || {}) } as ColDef<any>}
        autoSizeStrategy={
          autoFit ? ({ type: 'fitGridWidth', defaultMinWidth: 90, columnLimits } as any) : undefined
        }
        onGridReady={onGridReady}
        onFirstDataRendered={onFirstDataRendered}
        rowSelection={enableRangeSelection ? 'multiple' : undefined}
        cellSelection={enableRangeSelection}
        suppressClipboardPaste={!enableRangeSelection}
        sendToClipboard={
          enableRangeSelection
            ? (params: any) => {
                try {
                  navigator.clipboard?.writeText?.(params.data);
                } catch {}
              }
            : undefined
        }
        getRowId={(p) => String(p.data.__id ?? p.data.metric)}
      />
    </div>
  );
};

export default SimpleGrid;


