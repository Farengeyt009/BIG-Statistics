import React, { useState, useCallback, useMemo, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { AgGridReact } from '@ag-grid-community/react';
import type { ColDef } from '@ag-grid-community/core';
import '@ag-grid-community/styles/ag-grid.css';
import '@ag-grid-community/styles/ag-theme-quartz.css';
import './ag-grid-overrides.css';
import { useTranslation } from 'react-i18next';
import AgGridExportButton from '../../../../../../components/AgGrid/ExportButton';
import FocusModeToggle from '../../../../../../components/focus/FocusModeToggle';
import LoadingSpinner from '../../../../../../components/ui/LoadingSpinner';
import { applyStandardFilters } from '../../../../../../components/AgGrid/filterUtils';

const fmt2 = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2, minimumFractionDigits: 2 });

const fmtVal  = (v: any): string => (v == null || Number(v) === 0) ? '' : fmt2.format(Number(v));
const fmtCost = (v: any): string => (v == null || Number(v) === 0) ? '' : `￥${fmt2.format(Number(v))}`;

const NUM_FIELDS = [
  'FACT_QTY', 'Weight_FACT', 'Cost_FACT',
  'Debugging_QTY', 'Weight_Debugging', 'Cost_Debugging',
  'QCCard_Others_QTY', 'Weight_Others', 'Cost_Others',
  'GP_Weight', 'Price',
];

interface Props {
  data: any[];
  loading: boolean;
  error: string | null;
  suppressLocalLoaders?: boolean;
}

const StampingWastesTable: React.FC<Props> = ({ data, loading, error, suppressLocalLoaders }) => {
  const { t, i18n } = useTranslation('qc');
  const currentLanguage = i18n.language as 'en' | 'zh' | 'ru';

  const [gridApi, setGridApi]     = useState<any>(null);
  const gridWrapperRef            = useRef<HTMLDivElement | null>(null);
  const [gridHeightPx, setGridHeightPx] = useState<number | null>(null);
  const [isReadyToShow, setIsReadyToShow] = useState(false);
  const renderTimeoutRef = useRef<number | null>(null);
  const apiRef = useRef<any>(null);
  const copied = useRef<Set<string>>(new Set());

  useLayoutEffect(() => {
    if (loading) {
      setIsReadyToShow(false);
      if (renderTimeoutRef.current) clearTimeout(renderTimeoutRef.current);
      return;
    }
    if (renderTimeoutRef.current) clearTimeout(renderTimeoutRef.current);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        renderTimeoutRef.current = setTimeout(() => setIsReadyToShow(true), 100);
      });
    });
    return () => { if (renderTimeoutRef.current) clearTimeout(renderTimeoutRef.current); };
  }, [loading]);

  useLayoutEffect(() => {
    const compute = () => {
      const el = gridWrapperRef.current;
      if (!el) return;
      const isFocus = document.body.classList.contains('app-focus');
      if (!isFocus) { setGridHeightPx(null); return; }
      const top = el.getBoundingClientRect().top;
      setGridHeightPx(Math.max(200, Math.floor(window.innerHeight - top - 8)));
    };
    compute();
    window.addEventListener('resize', compute);
    const obs = new MutationObserver(compute);
    obs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => { window.removeEventListener('resize', compute); obs.disconnect(); };
  }, [gridApi]);

  const getCellKey = (node: any, field: string) => `${node.id}|${field}`;
  const getRowId = useCallback((p: any) => p.data.__rid, []);

  const markCopied = useCallback((api: any) => {
    if (!api?.getCellRanges) return;
    const ranges = api.getCellRanges?.() || [];
    const set = new Set<string>();
    const clipboardData: string[][] = [];
    for (const r of ranges) {
      const cols = r.columns || [];
      const start = Math.min(r.startRow.rowIndex, r.endRow.rowIndex);
      const end   = Math.max(r.startRow.rowIndex, r.endRow.rowIndex);
      for (let i = start; i <= end; i++) {
        const node = api.getDisplayedRowAtIndex(i);
        if (!node?.data) continue;
        const rowData: string[] = [];
        cols.forEach((c: any) => {
          const field = c.getColDef().field;
          rowData.push(String(node.data[field] ?? ''));
          set.add(getCellKey(node, field));
        });
        if (rowData.length) clipboardData.push(rowData);
      }
    }
    if (clipboardData.length) {
      const tsv = clipboardData.map(r => r.join('\t')).join('\n');
      try { navigator.clipboard.writeText(tsv); } catch {
        const ta = document.createElement('textarea');
        ta.value = tsv; document.body.appendChild(ta); ta.select();
        document.execCommand('copy'); document.body.removeChild(ta);
      }
    }
    copied.current = set;
    api.refreshCells?.({ force: true, suppressFlash: true });
  }, []);

  const sendToClipboard = useCallback(() => markCopied(apiRef.current), [markCopied]);
  const onCellKeyDown   = useCallback((e: any) => {
    const ke = e.event as KeyboardEvent;
    if ((ke.ctrlKey || ke.metaKey) && ke.key.toLowerCase() === 'c') { markCopied(e.api); return; }
    if (ke.key === 'Escape' && copied.current.size) {
      copied.current.clear();
      e.api.refreshCells?.({ force: true, suppressFlash: true });
    }
  }, [markCopied]);
  const onCellDoubleClicked = useCallback(() => {
    if (copied.current.size) { copied.current.clear(); gridApi?.refreshCells?.({ force: true, suppressFlash: true }); }
  }, [gridApi]);

  const processedData = useMemo(() => data.map((row, i) => {
    const rec: any = { ...row, __rid: String(i), Date: row.Date ? String(row.Date).slice(0, 10) : '' };
    for (const f of NUM_FIELDS) {
      rec[f] = rec[f] != null && rec[f] !== '' ? Number(rec[f]) : null;
    }
    return rec;
  }), [data]);

  const collectValues = useCallback((params: any, colId: string, getter: (r: any) => string) => {
    const api   = params.api;
    const model = { ...(api.getFilterModel?.() ?? {}) };
    delete (model as any)[colId];
    const setFilters: Array<{ colId: string; allowed: Set<string> }> = [];
    for (const [k, m] of Object.entries(model)) {
      if ((m as any)?.filterType === 'set' && Array.isArray((m as any).values))
        setFilters.push({ colId: k, allowed: new Set((m as any).values as string[]) });
    }
    const pass = (row: any) => setFilters.every(f => f.allowed.has(String(row?.[f.colId] ?? '').trim()));
    const uniq = new Set<string>();
    processedData.forEach(r => { if (pass(r)) { const v = getter(r); if (v) uniq.add(v); } });
    params.success(Array.from(uniq).sort((a, b) => a.localeCompare(b)));
  }, [processedData]);

  const monthLabel = useCallback((mm: string) => {
    const i = Math.max(0, Math.min(11, parseInt(mm, 10) - 1));
    const names = {
      en: ['January','February','March','April','May','June','July','August','September','October','November','December'],
      ru: ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'],
      zh: ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'],
    } as const;
    return (names[currentLanguage] ?? names.en)[i];
  }, [currentLanguage]);

  const dateFilterParams = useCallback((colId: string) => ({
    treeList: true as any,
    includeBlanksInFilter: true,
    refreshValuesOnOpen: true,
    values: (params: any) => collectValues(params, colId, r => String(r?.[colId] ?? '')),
    treeListPathGetter: (value: any) => {
      const s = String(value ?? '').trim();
      const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!m) return null;
      return [m[1], monthLabel(m[2]), m[3]];
    },
    valueFormatter: (p: any) => {
      const s = String(p.value ?? '');
      const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      return m ? `${m[3]}.${m[2]}.${m[1]}` : s;
    },
  }), [collectValues, monthLabel]);

  const setFilter = useCallback((colId: string, getter: (r: any) => string) => ({
    filter: 'agSetColumnFilter' as const,
    filterParams: { refreshValuesOnOpen: true, values: (p: any) => collectValues(p, colId, getter) },
  }), [collectValues]);

  const numCol  = (field: string, headerName: string, width: number): ColDef => ({
    field,
    headerName,
    minWidth: width, width,
    cellClass: 'text-right',
    cellDataType: 'number',
    valueFormatter: (p: any) => fmtVal(p.value),
  });

  const costCol = (field: string, headerName: string, width: number): ColDef => ({
    field,
    headerName,
    minWidth: width, width,
    cellClass: 'text-right',
    cellDataType: 'number',
    valueFormatter: (p: any) => fmtCost(p.value),
  });

  const columnDefs: ColDef[] = useMemo(() => applyStandardFilters([
    {
      field: 'Date',
      headerName: t('columns.date'),
      minWidth: 110, width: 110,
      cellDataType: 'date',
      cellClass: 'text-center',
      filter: 'agSetColumnFilter',
      filterValueGetter: (p: any) => String(p?.data?.Date ?? ''),
      filterParams: dateFilterParams('Date'),
      valueFormatter: (p) => {
        const s = String(p.value ?? '');
        const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        return m ? `${m[3]}.${m[2]}.${m[1]}` : s;
      },
    },
    {
      field: 'NomenclatureNumber',
      headerName: t('columns.article'),
      minWidth: 90, width: 130,
      ...setFilter('NomenclatureNumber', r => String(r?.NomenclatureNumber ?? '').trim()),
    },
    {
      field: 'ProductName_CN',
      headerName: t('columns.name'),
      minWidth: 140, width: 240,
      tooltipField: 'ProductName_CN',
      ...setFilter('ProductName_CN', r => String(r?.ProductName_CN ?? '').trim()),
    },
    costCol('Price',            t('wastes.columns.price'),             100),
    numCol('GP_Weight',         t('wastes.columns.gpWeight'),          120),
    numCol('FACT_QTY',          t('wastes.columns.factQty'),           120),
    numCol('Weight_FACT',       t('wastes.columns.weightFact'),        140),
    costCol('Cost_FACT',        t('wastes.columns.costFact'),          130),
    numCol('QCCard_Others_QTY', t('wastes.columns.othersQty'),         130),
    numCol('Weight_Others',     t('wastes.columns.weightOthers'),      155),
    costCol('Cost_Others',      t('wastes.columns.costOthers'),        155),
    numCol('Debugging_QTY',     t('wastes.columns.debuggingQty'),      155),
    numCol('Weight_Debugging',  t('wastes.columns.weightDebugging'),   155),
    costCol('Cost_Debugging',   t('wastes.columns.costDebugging'),     155),
  ]), [t, dateFilterParams, setFilter]);

  const defaultColDef: ColDef = {
    resizable: true,
    sortable: true,
    filter: true,
    minWidth: 60,
    cellClassRules: {
      'copied-cell': (p: any) =>
        p?.node && p?.colDef?.field ? copied.current.has(getCellKey(p.node, p.colDef.field)) : false,
    },
  };

  const onGridReady = (params: any) => { apiRef.current = params.api; setGridApi(params.api); };

  const actionsSlot = typeof document !== 'undefined'
    ? document.getElementById('qc-wastes-stamping-actions-slot') : null;
  const actions = (
    <div className="flex items-center gap-2">
      <AgGridExportButton api={gridApi} fileName="stamping_wastes" variant="icon" />
      <FocusModeToggle variant="dark" />
    </div>
  );

  if (loading && suppressLocalLoaders)
    return <div className="ag-theme-quartz" style={{ width: '100%', height: 'calc(100vh - 200px)' }} />;

  if ((loading || !isReadyToShow) && !suppressLocalLoaders)
    return <div className="flex justify-center items-center h-96 bg-white rounded"><LoadingSpinner overlay="screen" size="xl" /></div>;

  if (error)
    return <div className="flex justify-center items-center h-64"><div className="text-lg text-red-600">Error: {error}</div></div>;

  return (
    <>
      {actionsSlot ? createPortal(actions, actionsSlot) : <div className="flex items-center justify-end mb-2">{actions}</div>}
      <div
        ref={gridWrapperRef}
        className="ag-theme-quartz w-full"
        style={{ height: gridHeightPx != null ? `${gridHeightPx}px` : 'calc(100vh - 200px)' }}
      >
        <AgGridReact
          rowData={processedData}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          onGridReady={onGridReady}
          animateRows={false}
          cellSelection={true}
          suppressCopyRowsToClipboard={false}
          rowSelection="multiple"
          getRowId={getRowId}
          sendToClipboard={sendToClipboard}
          onCellKeyDown={onCellKeyDown}
          onCellDoubleClicked={onCellDoubleClicked}
          suppressDragLeaveHidesColumns={true}
          statusBar={{ statusPanels: [{ statusPanel: 'agAggregationComponent', align: 'left' }] }}
        />
      </div>
    </>
  );
};

export default StampingWastesTable;
