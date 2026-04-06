import React, { useState, useCallback, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
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

const BoolCell = (p: any) =>
  p.value === '1'
    ? <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, background: '#16a34a', borderRadius: 4, color: '#fff', fontSize: 11, fontWeight: 'bold', lineHeight: 1 }}>✓</span>
    : <span style={{ color: '#d1d5db', fontSize: 13 }}>–</span>;

const BOOL_COL_DEF = (field: string, headerName: string, width: number): ColDef => ({
  field,
  headerName,
  minWidth: width, width,
  cellClass: 'text-center',
  filter: 'agSetColumnFilter',
  filterParams: {
    refreshValuesOnOpen: true,
    values: ['1', '0'],
    valueFormatter: (p: any) => p.value === '1' ? '✓ Yes' : '– No',
  },
  filterValueGetter: (p: any) => String(p.data?.[field]),
  sortable: true,
  cellRenderer: BoolCell,
});

const fmtNum = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2, minimumFractionDigits: 0 });

interface LQCLogTableProps {
  data: any[];
  loading: boolean;
  error: string | null;
  onTableReady?: (api: any) => void;
  suppressLocalLoaders?: boolean;
}

const LQCLogTable: React.FC<LQCLogTableProps> = ({ data, loading, error, onTableReady, suppressLocalLoaders }) => {
  const { t, i18n } = useTranslation('qc');
  const currentLanguage = i18n.language as 'en' | 'zh' | 'ru';

  const [gridApi, setGridApi] = useState<any>(null);
  const gridWrapperRef = useRef<HTMLDivElement | null>(null);
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

  useEffect(() => {
    if (gridApi && onTableReady) onTableReady(gridApi);
  }, [gridApi, onTableReady]);

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
      const end = Math.max(r.startRow.rowIndex, r.endRow.rowIndex);
      for (let i = start; i <= end; i++) {
        const node = api.getDisplayedRowAtIndex(i);
        if (!node?.data) continue;
        const rowData: string[] = [];
        cols.forEach((c: any) => {
          const field = c.getColDef().field;
          rowData.push(String(node.data[field] ?? ''));
          set.add(getCellKey(node, field));
        });
        if (rowData.length > 0) clipboardData.push(rowData);
      }
    }
    if (clipboardData.length > 0) {
      const tsv = clipboardData.map(r => r.join('\t')).join('\n');
      try { navigator.clipboard.writeText(tsv); } catch {
        const ta = document.createElement('textarea');
        ta.value = tsv;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
    }
    copied.current = set;
    api.refreshCells?.({ force: true, suppressFlash: true });
  }, []);

  const sendToClipboard = useCallback(() => markCopied(apiRef.current), [markCopied]);

  const onCellKeyDown = useCallback((e: any) => {
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

  const isTrue = (v: any) => String(v ?? '').toLowerCase() === '01';

  const processedData = useMemo(() => {
    return data.map((row, i) => ({
      ...row,
      __rid: String(i),
      Delete_Mark:        isTrue(row.Delete_Mark) ? '1' : '0',
      Post_Mark:          isTrue(row.Post_Mark)   ? '1' : '0',
      Date:               row.Date ? String(row.Date).slice(0, 10) : '',
      ControlTochka:      currentLanguage === 'zh' ? row.Control_Tochka_Zh : row.Control_Tochka_Ru,
      DefectType:         currentLanguage === 'zh' ? row.Defect_Type_Zh    : row.Defect_Type_Ru,
      GuiltyDept:         currentLanguage === 'zh' ? row.Vinovnik_Dep_Zh   : row.Vinovnik_Dep_Ru,
      NomenclatureName:   currentLanguage === 'zh' ? row.Work_Nomenclature_Namezh : row.Work_Nomenclature_NameRU,
      Prod_Fact_QTY:      row.Prod_Fact_QTY  != null ? Number(row.Prod_Fact_QTY)  : null,
      Defect_QTY:         row.Defect_QTY     != null ? Number(row.Defect_QTY)     : null,
      Prod_QTY:           row.Prod_QTY       != null ? Number(row.Prod_QTY)       : null,
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, currentLanguage]);

  const collectValues = useCallback((params: any, colId: string, valueGetter: (r: any) => string) => {
    const api = params.api;
    const model = { ...(api.getFilterModel?.() ?? {}) };
    delete (model as any)[colId];
    const setFilters: Array<{ colId: string; allowed: Set<string> }> = [];
    for (const [k, m] of Object.entries(model)) {
      if ((m as any)?.filterType === 'set' && Array.isArray((m as any).values))
        setFilters.push({ colId: k, allowed: new Set((m as any).values as string[]) });
    }
    const pass = (row: any) => setFilters.every(f => f.allowed.has(String(row?.[f.colId] ?? '').trim()));
    const uniq = new Set<string>();
    processedData.forEach(r => { if (pass(r)) { const v = valueGetter(r); if (v) uniq.add(v); } });
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
    values: (params: any) => collectValues(params, colId, (r) => String(r?.[colId] ?? '')),
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

  const columnDefs: ColDef[] = useMemo(() => {
    const rest = applyStandardFilters([
      // 3 — Date
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
      // 4 — Doc No
      {
        field: 'Doc_No',
        headerName: t('lqc.docNo'),
        minWidth: 120, width: 130,
        ...setFilter('Doc_No', r => String(r?.Doc_No ?? '').trim()),
      },
      // 8 — Control Point
      {
        field: 'ControlTochka',
        headerName: t('lqc.controlPoint'),
        minWidth: 130, width: 150,
        tooltipField: 'ControlTochka',
        ...setFilter('ControlTochka', r => String(r?.ControlTochka ?? '').trim()),
      },
      // 11 — Large Group
      {
        field: 'LargeGroup',
        headerName: t('lqc.largeGroup'),
        minWidth: 120, width: 140,
        ...setFilter('LargeGroup', r => String(r?.LargeGroup ?? '').trim()),
      },
      // 12 — Group
      {
        field: 'GroupName',
        headerName: t('lqc.groupName'),
        minWidth: 120, width: 140,
        ...setFilter('GroupName', r => String(r?.GroupName ?? '').trim()),
      },
      // 6 — Prod Order No
      {
        field: 'Prod_Order_No',
        headerName: t('columns.orderNo'),
        minWidth: 120, width: 140,
        ...setFilter('Prod_Order_No', r => String(r?.Prod_Order_No ?? '').trim()),
      },
      // 7 — Customer Order No
      {
        field: 'Customer_Order_No',
        headerName: t('columns.customerOrder'),
        minWidth: 140, width: 160,
        ...setFilter('Customer_Order_No', r => String(r?.Customer_Order_No ?? '').trim()),
      },
      // 9 — Article
      {
        field: 'Work_Nomenclature_No',
        headerName: t('columns.article'),
        minWidth: 110, width: 130,
        ...setFilter('Work_Nomenclature_No', r => String(r?.Work_Nomenclature_No ?? '').trim()),
      },
      // 10 — Name
      {
        field: 'NomenclatureName',
        headerName: t('columns.name'),
        minWidth: 180, width: 260,
        tooltipField: 'NomenclatureName',
        ...setFilter('NomenclatureName', r => String(r?.NomenclatureName ?? '').trim()),
      },
      // 15 — Prod Fact QTY
      {
        field: 'Prod_Fact_QTY',
        headerName: t('lqc.prodFactQty'),
        minWidth: 100, width: 110,
        cellClass: 'text-center',
        cellDataType: 'number',
        valueFormatter: (p) => p.value != null ? fmtNum.format(p.value) : '',
      },
      // 16 — Defect QTY
      {
        field: 'Defect_QTY',
        headerName: t('lqc.defectQty'),
        minWidth: 90, width: 100,
        cellClass: 'text-center',
        cellDataType: 'number',
        valueFormatter: (p) => p.value != null ? fmtNum.format(p.value) : '',
      },
      // 13 — Defect Type
      {
        field: 'DefectType',
        headerName: t('columns.defectType'),
        minWidth: 130, width: 150,
        tooltipField: 'DefectType',
        ...setFilter('DefectType', r => String(r?.DefectType ?? '').trim()),
      },
      // 14 — Guilty Dept
      {
        field: 'GuiltyDept',
        headerName: t('columns.guiltyDept'),
        minWidth: 120, width: 140,
        tooltipField: 'GuiltyDept',
        ...setFilter('GuiltyDept', r => String(r?.GuiltyDept ?? '').trim()),
      },
      // 21 — Problem
      {
        field: 'Problem_Description',
        headerName: t('lqc.problem'),
        minWidth: 160, width: 200,
        tooltipField: 'Problem_Description',
        filter: 'agTextColumnFilter',
      },
      // 22 — Problem 2
      {
        field: 'Problem_Description1',
        headerName: t('lqc.problem2'),
        minWidth: 160, width: 200,
        tooltipField: 'Problem_Description1',
        filter: 'agTextColumnFilter',
      },
      // 17 — Prod QTY
      {
        field: 'Prod_QTY',
        headerName: t('lqc.prodQty'),
        minWidth: 90, width: 100,
        cellClass: 'text-center',
        cellDataType: 'number',
        valueFormatter: (p) => p.value != null ? fmtNum.format(p.value) : '',
      },
      // 5 — Author
      {
        field: 'Avtor',
        headerName: t('columns.author'),
        minWidth: 120, width: 140,
        ...setFilter('Avtor', r => String(r?.Avtor ?? '').trim()),
      },
    ]);
    return [
      BOOL_COL_DEF('Delete_Mark', t('columns.del'), 80),
      BOOL_COL_DEF('Post_Mark', t('lqc.posted'), 100),
      ...rest,
    ];
  }, [t, dateFilterParams, setFilter]);

  const defaultColDef: ColDef = {
    resizable: true,
    sortable: true,
    filter: true,
    cellClassRules: {
      'copied-cell': (p: any) =>
        p?.node && p?.colDef?.field ? copied.current.has(getCellKey(p.node, p.colDef.field)) : false,
    },
  };

  const onGridReady = (params: any) => { apiRef.current = params.api; setGridApi(params.api); };

  const actionsSlot = typeof document !== 'undefined' ? document.getElementById('qc-lqc-log-actions-slot') : null;
  const actions = (
    <div className="flex items-center gap-2">
      <AgGridExportButton api={gridApi} fileName="lqc_journal" variant="icon" />
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

export default LQCLogTable;
