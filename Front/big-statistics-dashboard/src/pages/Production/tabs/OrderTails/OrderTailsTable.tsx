import React, { useCallback, useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { AgGridReact } from '@ag-grid-community/react';
import type { ColDef } from '@ag-grid-community/core';
import '@ag-grid-community/styles/ag-grid.css';
import '@ag-grid-community/styles/ag-theme-quartz.css';
import LoadingSpinner from '../../../../components/ui/LoadingSpinner';
import AgGridExportButton from '../../../../components/AgGrid/ExportButton';
import FocusModeToggle from '../../../../components/focus/FocusModeToggle';
import { apiGetOrderTails, OrderTailRow } from '../../../../config/timeloss-api';
import { applyStandardFilters } from '../../../../components/AgGrid/filterUtils';

type Props = { rows?: OrderTailRow[]; suppressLocalLoaders?: boolean; onLoadingChange?: (l: boolean)=>void };

const OrderTailsTable: React.FC<Props> = ({ rows: externalRows, suppressLocalLoaders, onLoadingChange }) => {
  const { t, i18n } = useTranslation('production');
  const lang = (i18n.language as 'en' | 'zh' | 'ru') || 'en';
  const [rows, setRows] = useState<OrderTailRow[]>([]);
  const [activeOnly, setActiveOnly] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [gridApi, setGridApi] = useState<any | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const copied = useRef<Set<string>>(new Set());
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      onLoadingChange?.(true);
      try {
        const base = (externalRows && externalRows.length) ? externalRows : await apiGetOrderTails();
        const filtered = activeOnly ? (base || []).filter(r => Number(r.Active_Tail) === 1) : (base || []);
        if (!cancelled) setRows(filtered);
      } finally {
        if (!cancelled) setLoading(false);
        onLoadingChange?.(false);
      }
    })();
    return () => { cancelled = true; };
  }, [externalRows, activeOnly]);

  // Слушаем переключатель на верхней панели
  useEffect(() => {
    const handler = (e: any) => {
      const active = !!e?.detail?.activeOnly;
      setActiveOnly(active);
    };
    window.addEventListener('ot-toggle-active-only', handler as any);
    return () => window.removeEventListener('ot-toggle-active-only', handler as any);
  }, []);

  const getRowId = useCallback((p: any) => `${p.data.OrderNumber}|${p.data.NomenclatureNumber}|${p.rowIndex}`, []);

  const fmtInt = useMemo(() => new Intl.NumberFormat(undefined, { maximumFractionDigits: 0, minimumFractionDigits: 0 }), []);

  const defaultColDef: ColDef = useMemo(() => ({ resizable: true, sortable: true, filter: true, cellClassRules: { 'copied-cell': (params: any) => copied.current.has(`${params.node?.id}|${params.colDef?.field}`) } }), []);

  const toIso = (s: any): string => {
    if (!s) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(s))) return String(s);
    const d = new Date(s);
    return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
  };

  const collectValuesIgnoringSelf = useCallback((params: any, colId: string, valueGetter: (row: OrderTailRow)=>string) => {
    const api = params.api;
    const model = { ...(api.getFilterModel?.() ?? {}) } as Record<string, any>;
    delete model[colId];
    const setFilters: Array<{ colId: string; allowed: Set<string> }> = [];
    for (const [k, m] of Object.entries(model)) {
      if ((m as any)?.filterType === 'set' && Array.isArray((m as any).values)) {
        setFilters.push({ colId: k, allowed: new Set((m as any).values as string[]) });
      }
    }
    const passOtherSetFilters = (row: any) => {
      for (const f of setFilters) {
        const v = (f.colId === 'TailStartDate' || f.colId === 'TailResolvedDate')
          ? String(toIso((row as any)[f.colId]))
          : String((row as any)[f.colId] ?? '').trim();
        if (f.allowed.size && !f.allowed.has(v)) return false;
      }
      return true;
    };
    const uniq = new Set<string>();
    (rows || []).forEach(r => { if (!passOtherSetFilters(r)) return; const v = valueGetter(r); if (v) uniq.add(v); });
    params.success(Array.from(uniq).sort());
  }, [rows]);

  const columnDefs: ColDef[] = useMemo(() => ([
    { field: 'LargeGroup', headerName: t('orderTailsStats.largeGroup') as string, minWidth: 160, filter: 'agSetColumnFilter', filterValueGetter: (p: any) => String(p?.data?.LargeGroup ?? '').trim(), filterParams: { includeBlanksInFilter: true, refreshValuesOnOpen: true, values: (p: any)=>collectValuesIgnoringSelf(p, 'LargeGroup', r=>String(r.LargeGroup||'').trim()) } },
    { field: 'OrderNumber', headerName: t('orderTailsTable.orderNo') as string, minWidth: 140, filter: 'agSetColumnFilter', filterValueGetter: (p: any) => String(p?.data?.OrderNumber ?? '').trim(), filterParams: { includeBlanksInFilter: true, refreshValuesOnOpen: true, values: (p: any)=>collectValuesIgnoringSelf(p, 'OrderNumber', r=>String(r.OrderNumber||'').trim()) } },
    { field: 'NomenclatureNumber', headerName: t('orderTailsTable.articleNumber') as string, minWidth: 160, filter: 'agSetColumnFilter', filterValueGetter: (p: any) => String(p?.data?.NomenclatureNumber ?? '').trim(), filterParams: { includeBlanksInFilter: true, refreshValuesOnOpen: true, values: (p: any)=>collectValuesIgnoringSelf(p, 'NomenclatureNumber', r=>String(r.NomenclatureNumber||'').trim()) } },
    { field: 'GroupName', headerName: t('orderTailsStats.groupName') as string, minWidth: 160, filter: 'agSetColumnFilter', filterValueGetter: (p: any) => String(p?.data?.GroupName ?? '').trim(), filterParams: { includeBlanksInFilter: true, refreshValuesOnOpen: true, values: (p: any)=>collectValuesIgnoringSelf(p, 'GroupName', r=>String(r.GroupName||'').trim()) } },
    { field: 'Total_QTY', headerName: t('orderTailsTable.orderQty') as string, minWidth: 110, cellClass: 'text-center', cellDataType: 'number', valueFormatter: (p:any)=>fmtInt.format(Math.round(parseFloat(String(p.value||'0'))||0)) },
    { field: 'FactTotal_QTY', headerName: t('orderTailsTable.complQty') as string, minWidth: 120, cellClass: 'text-center', cellDataType: 'number', valueFormatter: (p:any)=>fmtInt.format(Math.round(parseFloat(String(p.value||'0'))||0)) },
    { field: 'TailDays', headerName: t('orderTailsTable.tailDays') as string, minWidth: 110, cellClass: 'text-center', cellDataType: 'number', valueFormatter: (p:any)=>fmtInt.format(Math.round(Number(p.value||0))) },
    { field: 'TailStartDate', headerName: t('orderTailsTable.tailStartDate') as string, minWidth: 160, filter: 'agSetColumnFilter', valueFormatter: (p:any)=> {
      const s = String(p.value ?? '').trim();
      if (!s) return '';
      const d = new Date(s);
      if (isNaN(d.getTime())) return s;
      const dd = String(d.getDate()).padStart(2,'0');
      const mm = String(d.getMonth()+1).padStart(2,'0');
      const yyyy = d.getFullYear();
      return `${dd}.${mm}.${yyyy}`;
    }, filterValueGetter: (p:any)=> toIso(p?.data?.TailStartDate), filterParams: { treeList: true as any, includeBlanksInFilter: true, refreshValuesOnOpen: true, values: (p:any)=>collectValuesIgnoringSelf(p, 'TailStartDate', r=>toIso(r.TailStartDate as any)), treeListPathGetter: (value:any)=> {
      const s = String(value ?? '').trim();
      const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!m) return null;
      const [, y, mm, dd] = m;
      const months = lang === 'zh' ? ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'] : lang === 'ru' ? ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'] : ['January','February','March','April','May','June','July','August','September','October','November','December'];
      return [y, months[Math.max(0, Math.min(11, parseInt(mm,10)-1))], dd];
    }, valueFormatter: (p:any)=> { const s = String(p.value ?? ''); const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? `${m[3]}.${m[2]}.${m[1]}` : s; } } },
    { field: 'TailResolvedDate', headerName: t('orderTailsTable.tailResolvedDate') as string, minWidth: 160, filter: 'agSetColumnFilter', valueFormatter: (p:any)=> {
      const s = String(p.value ?? '').trim();
      if (!s) return '';
      const d = new Date(s);
      if (isNaN(d.getTime())) return s;
      const dd = String(d.getDate()).padStart(2,'0');
      const mm = String(d.getMonth()+1).padStart(2,'0');
      const yyyy = d.getFullYear();
      return `${dd}.${mm}.${yyyy}`;
    }, filterValueGetter: (p:any)=> toIso(p?.data?.TailResolvedDate), filterParams: { treeList: true as any, includeBlanksInFilter: true, refreshValuesOnOpen: true, values: (p:any)=>collectValuesIgnoringSelf(p, 'TailResolvedDate', r=>toIso(r.TailResolvedDate as any)), treeListPathGetter: (value:any)=> {
      const s = String(value ?? '').trim();
      const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!m) return null;
      const [, y, mm, dd] = m;
      const months = lang === 'zh' ? ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'] : lang === 'ru' ? ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'] : ['January','February','March','April','May','June','July','August','September','October','November','December'];
      return [y, months[Math.max(0, Math.min(11, parseInt(mm,10)-1))], dd];
    }, valueFormatter: (p:any)=> { const s = String(p.value ?? ''); const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? `${m[3]}.${m[2]}.${m[1]}` : s; } } },
  ]), [t, fmtInt, collectValuesIgnoringSelf, lang]);

  const columnDefsWithStandardFilters = useMemo(() => {
    return applyStandardFilters(columnDefs);
  }, [columnDefs]);

  const markCopied = useCallback((api: any) => {
    if (!api?.getCellRanges) return;
    const ranges = api.getCellRanges?.() || [];
    const set = new Set<string>();
    const clipboard: string[][] = [];
    for (const r of ranges) {
      const cols = r.columns || [];
      const start = Math.min(r.startRow.rowIndex, r.endRow.rowIndex);
      const end = Math.max(r.startRow.rowIndex, r.endRow.rowIndex);
      for (let i = start; i <= end; i++) {
        const node = api.getDisplayedRowAtIndex(i);
        if (!node?.data) continue;
        const row: string[] = [];
        cols.forEach((c: any) => {
          const field = c.getColDef().field;
          row.push(String(node.data[field] ?? ''));
          set.add(`${node.id}|${field}`);
        });
        if (row.length) clipboard.push(row);
      }
    }
    if (clipboard.length) {
      const tsv = clipboard.map(r => r.join('\t')).join('\n');
      try { navigator.clipboard.writeText(tsv); } catch {}
    }
    copied.current = set;
    api.refreshCells?.({ force: true, suppressFlash: true });
  }, []);

  if (loading && suppressLocalLoaders) return null;
  if (loading || !isReadyToShow) return <LoadingSpinner overlay="screen" size="xl" />;

  const autoSizeStrategy = { type: 'fitGridWidth' as const };

  // Если на странице есть внешний слот — рендерим туда, как в Daily Staffing
  const actions = (
    <div className="flex items-center gap-2">
      <AgGridExportButton api={gridApi} fileName="order_tails" variant="icon" />
      <FocusModeToggle variant="dark" />
    </div>
  );
  const actionsSlot = typeof document !== 'undefined' ? document.getElementById('ot-actions-slot') : null;

  return (
    <div className="w-full">
      {actionsSlot ? createPortal(actions, actionsSlot) : (
        <div className="flex items-center gap-2 justify-end w-full px-1 mb-2">{actions}</div>
      )}
      <div ref={gridRef} className="ag-theme-quartz" style={{ width: '100%', height: '78vh' }}>
        <AgGridReact
          rowData={rows}
          columnDefs={columnDefsWithStandardFilters}
          defaultColDef={defaultColDef}
          autoSizeStrategy={autoSizeStrategy}
          onGridReady={(p) => setGridApi(p.api)}
          onGridSizeChanged={(p) => p.api.sizeColumnsToFit()}
          animateRows={false}
          cellSelection={true}
          rowSelection="multiple"
          getRowId={getRowId}
          sendToClipboard={() => gridApi && markCopied(gridApi)}
          onCellKeyDown={(e: any) => { const ke = e.event as KeyboardEvent; if ((ke.ctrlKey || ke.metaKey) && String(ke.key).toLowerCase() === 'c') { markCopied(e.api); return; } if (String(ke.key) === 'Escape') { if (copied.current.size) { copied.current.clear(); e.api.refreshCells?.({ force: true, suppressFlash: true }); } } }}
          onCellDoubleClicked={() => { if (copied.current.size) { copied.current.clear(); gridApi?.refreshCells?.({ force: true, suppressFlash: true }); } }}
          suppressDragLeaveHidesColumns={true}
          statusBar={{ statusPanels: [{ statusPanel: 'agAggregationComponent', align: 'left' }] }}
          context={{ gridName: 'order-tails-table' }}
        />
      </div>
    </div>
  );
};

export default OrderTailsTable;


