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

const BOOL_COLS = (t: (k: string) => string): ColDef[] => [
  BOOL_COL_DEF('Delete_Mark', t('columns.del'), 80),
  BOOL_COL_DEF('Posted_Mark', t('columns.posted'), 100),
];

const fmtNum = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2, minimumFractionDigits: 0 });

const conclusionMap: Record<number, string> = { 0: 'Repainting', 1: 'Rework', 2: 'Scrap', 3: 'Scrap + Remake', 4: 'Rework / Touch-up', 5: 'Re-stamping' };

interface LogTableProps {
  data: any[];
  loading: boolean;
  error: string | null;
  onTableReady?: (api: any) => void;
  suppressLocalLoaders?: boolean;
}

const LogTable: React.FC<LogTableProps> = ({ data, loading, error, onTableReady, suppressLocalLoaders }) => {
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

  // Авторасчёт высоты в фокус-режиме
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

  // 0x00 → false, 0x01 → true (backend сериализует bytes через .hex())
  const isTrue = (v: any) => String(v ?? '').toLowerCase() === '01';

  // Подготовка данных
  const processedData = useMemo(() => {
    return data.map((row, i) => ({
      ...row,
      __rid: String(i),
      Delete_Mark: isTrue(row.Delete_Mark) ? '1' : '0',
      Posted_Mark: isTrue(row.Posted_Mark) ? '1' : '0',
      Create_Date: row.Create_Date ? String(row.Create_Date).slice(0, 10) : '',
      Status_Date: row.Status_Date ? String(row.Status_Date).slice(0, 10) : '',
      Conclusion: t(`conclusion.${row.QCcardConclusion_No}`, { defaultValue: conclusionMap[row.QCcardConclusion_No as number] ?? String(row.QCcardConclusion_No ?? '') }),
      Name: currentLanguage === 'zh' ? row.QC_Card_Nomenclature_Namezh : row.QC_Card_Nomenclature_NameRU,
      Status: currentLanguage === 'zh' ? row.QC_Card_StatusZh : row.QC_Card_StatusRu,
      DefectType: currentLanguage === 'zh' ? row.Defect_TypeZh : row.Defect_TypeRu,
      GuiltyDept: currentLanguage === 'zh' ? row.VinovnikDep_Zh : row.VinovnikDep_Ru,
      QCCard_QTY:    row.QCCard_QTY    != null ? Number(row.QCCard_QTY)    : null,
      Material_Cost: row.Material_Cost != null ? Number(row.Material_Cost) * (Number(row.QCCard_QTY) || 1) : null,
      Labor_Hours:   row.Labor_Hours   != null ? Number(row.Labor_Hours)   * (Number(row.QCCard_QTY) || 1) : null,
      Labor_Cost:    row.Labor_Cost    != null ? Number(row.Labor_Cost)    * (Number(row.QCCard_QTY) || 1) : null,
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, currentLanguage, t]);

  // Хелпер для кросс-фильтров SetFilter
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

  const columnDefs: ColDef[] = useMemo(() => {
    const rest = applyStandardFilters([
      // Create_Date
      {
        field: 'Create_Date',
        headerName: t('columns.date'),
        minWidth: 110, width: 110,
        cellDataType: 'date',
        cellClass: 'text-center',
        filter: 'agSetColumnFilter',
        filterValueGetter: (p: any) => String(p?.data?.Create_Date ?? ''),
        filterParams: dateFilterParams('Create_Date'),
        valueFormatter: (p) => {
          const s = String(p.value ?? '');
          const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
          return m ? `${m[3]}.${m[2]}.${m[1]}` : s;
        },
      },
      // Status_Date
      {
        field: 'Status_Date',
        headerName: t('columns.statusDate'),
        minWidth: 110, width: 110,
        cellDataType: 'date',
        cellClass: 'text-center',
        filter: 'agSetColumnFilter',
        filterValueGetter: (p: any) => String(p?.data?.Status_Date ?? ''),
        filterParams: dateFilterParams('Status_Date'),
        valueFormatter: (p) => {
          const s = String(p.value ?? '');
          const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
          return m ? `${m[3]}.${m[2]}.${m[1]}` : s;
        },
      },
      // QC_Card_No
      {
        field: 'QC_Card_No',
        headerName: t('columns.cardNo'),
        minWidth: 110, width: 120,
        filter: 'agSetColumnFilter',
        filterParams: { refreshValuesOnOpen: true, values: (p: any) => collectValues(p, 'QC_Card_No', (r) => String(r?.QC_Card_No ?? '').trim()) },
      },
      // GuiltyDept (по языку)
      {
        field: 'GuiltyDept',
        headerName: t('columns.guiltyDept'),
        minWidth: 120, width: 150,
        tooltipField: 'GuiltyDept',
        filter: 'agSetColumnFilter',
        filterParams: { refreshValuesOnOpen: true, values: (p: any) => collectValues(p, 'GuiltyDept', (r) => String(r?.GuiltyDept ?? '').trim()) },
      },
      // Customer_Order_No
      {
        field: 'Customer_Order_No',
        headerName: t('columns.customerOrder'),
        minWidth: 140, width: 160,
        filter: 'agSetColumnFilter',
        filterParams: { refreshValuesOnOpen: true, values: (p: any) => collectValues(p, 'Customer_Order_No', (r) => String(r?.Customer_Order_No ?? '').trim()) },
      },
      // ProdOrder_No
      {
        field: 'ProdOrder_No',
        headerName: t('columns.orderNo'),
        minWidth: 120, width: 140,
        filter: 'agSetColumnFilter',
        filterParams: { refreshValuesOnOpen: true, values: (p: any) => collectValues(p, 'ProdOrder_No', (r) => String(r?.ProdOrder_No ?? '').trim()) },
      },
      // Article
      {
        field: 'QC_Card_Nomenclature_No',
        headerName: t('columns.article'),
        minWidth: 110, width: 130,
        filter: 'agSetColumnFilter',
        filterParams: { refreshValuesOnOpen: true, values: (p: any) => collectValues(p, 'QC_Card_Nomenclature_No', (r) => String(r?.QC_Card_Nomenclature_No ?? '').trim()) },
      },
      // Name (по языку)
      {
        field: 'Name',
        headerName: t('columns.name'),
        minWidth: 180, width: 260,
        tooltipField: 'Name',
        filter: 'agSetColumnFilter',
        filterParams: { refreshValuesOnOpen: true, values: (p: any) => collectValues(p, 'Name', (r) => String(r?.Name ?? '').trim()) },
      },
      // QTY
      {
        field: 'QCCard_QTY',
        headerName: t('columns.qty'),
        minWidth: 90, width: 110,
        cellClass: 'text-center',
        cellDataType: 'number',
        valueFormatter: (p) => p.value != null ? fmtNum.format(p.value) : '',
      },
      // Material_Cost
      {
        field: 'Material_Cost',
        headerName: t('columns.materialCost'),
        minWidth: 110, width: 120,
        cellClass: 'text-right',
        cellDataType: 'number',
        valueFormatter: (p) => p.value != null ? fmtNum.format(p.value) : '—',
      },
      // Labor_Cost (total)
      {
        field: 'Labor_Cost',
        headerName: t('columns.totalCost'),
        minWidth: 100, width: 110,
        cellClass: 'text-right font-medium',
        cellDataType: 'number',
        valueFormatter: (p) => p.value != null ? fmtNum.format(p.value) : '—',
      },
      // Conclusion
      {
        field: 'Conclusion',
        headerName: t('columns.conclusion'),
        minWidth: 130, width: 160,
        filter: 'agSetColumnFilter',
        filterParams: { refreshValuesOnOpen: true, values: (p: any) => collectValues(p, 'Conclusion', (r) => String(r?.Conclusion ?? '').trim()) },
      },
      // DefectType (по языку)
      {
        field: 'DefectType',
        headerName: t('columns.defectType'),
        minWidth: 120, width: 140,
        tooltipField: 'DefectType',
        filter: 'agSetColumnFilter',
        filterParams: { refreshValuesOnOpen: true, values: (p: any) => collectValues(p, 'DefectType', (r) => String(r?.DefectType ?? '').trim()) },
      },
      // Cause
      {
        field: 'Cause_of_Defect',
        headerName: t('columns.cause'),
        minWidth: 120, width: 150,
        tooltipField: 'Cause_of_Defect',
        filter: 'agSetColumnFilter',
        filterParams: { refreshValuesOnOpen: true, values: (p: any) => collectValues(p, 'Cause_of_Defect', (r) => String(r?.Cause_of_Defect ?? '').trim()) },
      },
      // Comment
      {
        field: 'Comment',
        headerName: t('columns.comment'),
        minWidth: 140, width: 180,
        tooltipField: 'Comment',
        filter: 'agSetColumnFilter',
        filterParams: { refreshValuesOnOpen: true, values: (p: any) => collectValues(p, 'Comment', (r) => String(r?.Comment ?? '').trim()) },
      },
      // Status (по языку)
      {
        field: 'Status',
        headerName: t('columns.status'),
        minWidth: 100, width: 120,
        filter: 'agSetColumnFilter',
        filterParams: { refreshValuesOnOpen: true, values: (p: any) => collectValues(p, 'Status', (r) => String(r?.Status ?? '').trim()) },
      },
      // Author
      {
        field: 'Avtor_Name',
        headerName: t('columns.author'),
        minWidth: 100, width: 120,
        filter: 'agSetColumnFilter',
        filterParams: { refreshValuesOnOpen: true, values: (p: any) => collectValues(p, 'Avtor_Name', (r) => String(r?.Avtor_Name ?? '').trim()) },
      },
      // Labor_Hours (cost of work)
      {
        field: 'Labor_Hours',
        headerName: t('columns.laborCost'),
        minWidth: 100, width: 110,
        cellClass: 'text-right',
        cellDataType: 'number',
        valueFormatter: (p) => p.value != null ? fmtNum.format(p.value) : '—',
      },
    ]);
    return [...BOOL_COLS(t), ...rest];
  }, [t, dateFilterParams, collectValues]);

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

  const actionsSlot = typeof document !== 'undefined' ? document.getElementById('qc-defect-log-actions-slot') : null;
  const actions = (
    <div className="flex items-center gap-2">
      <AgGridExportButton api={gridApi} fileName="defect_cards_log" variant="icon" />
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

export default LogTable;
