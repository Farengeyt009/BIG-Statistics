import React, { useCallback, useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import { AgGridReact } from '@ag-grid-community/react';
import '@ag-grid-community/styles/ag-grid.css';
import '@ag-grid-community/styles/ag-theme-quartz.css';
import type { ColDef, CellValueChangedEvent } from '@ag-grid-community/core';
import { useTranslation } from 'react-i18next';
import LoadingSpinner from '../../../../components/ui/LoadingSpinner';
import AgGridExportButton from '../../../../components/AgGrid/ExportButton';
import EditModeToggle from '../../../../components/AgGrid/EditModeToggle';
import FocusModeToggle from '../../../../components/focus/FocusModeToggle';
import { API_ENDPOINTS } from '../../../../config/api';
import { createPortal } from 'react-dom';
import ConfirmDialog from '../../../../components/ui/ConfirmDialog';

type Row = Record<string, any> & { _lid: string; _dirty?: Set<string> };

type Props = { year: number; month: number; toYear?: number; toMonth?: number };

const ShipmentPlanFactTable: React.FC<Props> = ({ year, month, toYear, toMonth }) => {
  const { t } = useTranslation('ordersTranslation');
  const gridApiRef = useRef<any>(null);
  const [gridApi, setGridApi] = useState<any | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true); // Инициализируем как true, чтобы сразу показать спиннер
  const [error, setError] = useState<string | null>(null);
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
  const [editMode, setEditMode] = useState<boolean>(false);
  const [confirmState, setConfirmState] = useState<{ open: boolean; message: string; onOk: () => void; danger?: boolean }>({ open: false, message: '', onOk: () => {}, danger: false });
  const hasDirty = useMemo(() => rows.some(r => r._dirty && r._dirty.size > 0), [rows]);
  const gridWrapperRef = useRef<HTMLDivElement | null>(null);
  const [gridHeightPx, setGridHeightPx] = useState<number | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const rangeParams = (toYear && toMonth) ? `&to_year=${toYear}&to_month=${toMonth}` : '';
      const res = await fetch(`${API_ENDPOINTS.ORDERS.SHIPMENT_PLAN_FACT}?year=${year}&month=${month}${rangeParams}`);
      const json = await res.json();
      const list: any[] = Array.isArray(json?.data) ? json.data : (Array.isArray(json) ? json : []);
      setRows(list.map((r, i) => ({ ...r, _lid: `${i}_${r.PeriodID ?? r.id ?? Math.random()}` })));
      setError(null);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }, [year, month, toYear, toMonth]);

  useEffect(() => { reload(); }, [reload]);

  const markDirty = useCallback((rid: string, field: string, value: any) => {
    setRows(prev => prev.map(r => (r._lid === rid ? { ...r, [field]: value, _dirty: new Set([...(r._dirty || []), field]) } : r)));
  }, []);

  const onCellValueChanged = useCallback((e: CellValueChangedEvent<Row>) => {
    const field = e.colDef.field as string | undefined;
    if (!field) return;
    markDirty(e.data._lid, field, e.newValue);
  }, [markDirty]);

  const saveDirty = useCallback(async () => {
    const dirty = rows.filter(r => r._dirty && r._dirty.size > 0);
    if (dirty.length === 0) return;

    // Формируем массив объектов для батч-сохранения
    const batch = dirty.map(r => {
      const payload: any = { PeriodID: r.PeriodID ?? r.periodId };
      for (const f of r._dirty as Set<string>) {
        payload[f] = (r as any)[f];
      }
      return payload;
    });

    try {
      // Отправляем ВСЕ изменения ОДНИМ запросом
      const response = await fetch(API_ENDPOINTS.ORDERS.SHIPMENT_PLAN_UPSERT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batch), // Отправляем массив
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      // Очищаем _dirty только после успешного сохранения
      setRows(prev => prev.map(r => (r._dirty && r._dirty.size ? { ...r, _dirty: new Set() } : r)));
      
      console.log(`✅ Сохранено ${batch.length} записей`);
    } catch (error) {
      console.error('❌ Ошибка при сохранении:', error);
      alert(`Ошибка при сохранении данных: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    }
  }, [rows]);

  const fmtNum = (v: any) => {
    if (v === null || v === undefined || v === '') return '';
    const n = Number(v);
    if (!isFinite(n)) return String(v);
    if (n === 0) return '';
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 4 }).format(n);
  };
  const fmtDate = (v: any) => {
    try {
      const d = new Date(v);
      if (isNaN(d.getTime())) return String(v ?? '');
      const dd = String(d.getDate()).padStart(2,'0');
      const mm = String(d.getMonth()+1).padStart(2,'0');
      const yy = d.getFullYear();
      return `${dd}.${mm}.${yy}`;
    } catch { return String(v ?? ''); }
  };

  // Custom tooltip for long comments (non-interactive)
  const CommentTooltip: React.FC<any> = (p) => {
    const text = String(p?.value ?? p?.data?.Comment ?? '');
    return (
      <div className="max-w-[560px] whitespace-pre-wrap break-words text-sm leading-5 p-2 bg-white border border-gray-300 shadow-lg rounded">
        {text}
      </div>
    );
  };

  const columns = useMemo<ColDef<Row>[]>(() => [
    { field: 'YearNum', headerName: String(t('shipmentPlanFact.YearNum')), width: 90, minWidth: 80, editable: false, cellClass: 'text-center' },
    { field: 'MonthNum', headerName: String(t('shipmentPlanFact.MonthNum')), width: 95, minWidth: 90, editable: false, cellClass: 'text-center' },
    { field: 'WeekNo', headerName: String(t('shipmentPlanFact.WeekNo')), width: 90, minWidth: 80, editable: false, cellClass: 'text-center' },
    { field: 'MonthPlanPcs_System', headerName: String(t('shipmentPlanFact.MonthPlanPcs_System')), width: 180, minWidth: 140, editable: false, cellDataType: 'number', cellClass: 'text-center', valueGetter: (p: any) => { const n = Number(p.data?.MonthPlanPcs_System); return isFinite(n) ? n : null; }, valueFormatter: (p: any) => fmtNum(p.value), clipboardValueGetter: (p: any) => (p.value == null ? '' : Number(p.value)) },
    { field: 'FactQty', headerName: String(t('shipmentPlanFact.FactQty')), width: 130, minWidth: 110, editable: false, cellDataType: 'number', cellClass: 'text-center', valueGetter: (p: any) => { const n = Number(p.data?.FactQty); return isFinite(n) ? n : null; }, valueFormatter: (p: any) => fmtNum(p.value), clipboardValueGetter: (p: any) => (p.value == null ? '' : Number(p.value)) },
    { field: 'DiffQty', headerName: String(t('shipmentPlanFact.DiffQty')), width: 140, minWidth: 110, editable: false, cellDataType: 'number', cellClass: 'text-center', valueGetter: (p: any) => { const n = Number(p.data?.DiffQty); return isFinite(n) ? n : null; }, valueFormatter: (p: any) => fmtNum(p.value), clipboardValueGetter: (p: any) => (p.value == null ? '' : Number(p.value)) },
    { field: 'ShipMonth_PlanPcs', headerName: String(t('shipmentPlanFact.ShipMonth_PlanPcs')), width: 200, minWidth: 140, editable: () => editMode, cellDataType: 'number', cellClass: 'text-center', valueParser: (p: any) => p.newValue == null || p.newValue === '' ? null : Number(p.newValue), valueGetter: (p: any) => { const n = Number(p.data?.ShipMonth_PlanPcs); return isFinite(n) ? n : null; }, valueFormatter: (p: any) => fmtNum(p.value), clipboardValueGetter: (p: any) => (p.value == null ? '' : Number(p.value)) },
    { field: 'ShipWeek_PlanPcs', headerName: String(t('shipmentPlanFact.ShipWeek_PlanPcs')), width: 200, minWidth: 140, editable: () => editMode, cellDataType: 'number', cellClass: 'text-center', valueParser: (p: any) => p.newValue == null || p.newValue === '' ? null : Number(p.newValue), valueGetter: (p: any) => { const n = Number(p.data?.ShipWeek_PlanPcs); return isFinite(n) ? n : null; }, valueFormatter: (p: any) => fmtNum(p.value), clipboardValueGetter: (p: any) => (p.value == null ? '' : Number(p.value)) },
    { field: 'ShipQty', headerName: String(t('shipmentPlanFact.ShipQty')), width: 140, minWidth: 110, editable: false, cellDataType: 'number', cellClass: 'text-center', valueGetter: (p: any) => { const v = p.data?.ShipQty; const n = Number(v); return isFinite(n) ? n : null; }, valueFormatter: (p: any) => fmtNum(p.value), clipboardValueGetter: (p: any) => (p.value == null ? '' : Number(p.value)) },
    { field: 'FGStockStartWeekPcs', headerName: String(t('shipmentPlanFact.FGStockStartWeekPcs')), width: 140, minWidth: 150, editable: () => editMode, cellDataType: 'number', cellClass: 'text-center', valueParser: (p: any) => p.newValue == null || p.newValue === '' ? null : Number(p.newValue), valueGetter: (p: any) => { const n = Number(p.data?.FGStockStartWeekPcs); return isFinite(n) ? n : null; }, valueFormatter: (p: any) => fmtNum(p.value), clipboardValueGetter: (p: any) => (p.value == null ? '' : Number(p.value)) },
    { field: 'ContainerQty', headerName: String(t('shipmentPlanFact.ContainerQty')), width: 140, minWidth: 160, editable: () => editMode, cellDataType: 'number', cellClass: 'text-center', valueParser: (p: any) => p.newValue == null || p.newValue === '' ? null : Number(p.newValue), valueGetter: (p: any) => { const n = Number(p.data?.ContainerQty); return isFinite(n) ? n : null; }, valueFormatter: (p: any) => fmtNum(p.value), clipboardValueGetter: (p: any) => (p.value == null ? '' : Number(p.value)) },
    { field: 'Comment', headerName: String(t('shipmentPlanFact.Comment')), width: 320, minWidth: 200, editable: () => editMode, tooltipComponent: 'commentTooltip', tooltipValueGetter: (p: any) => String(p?.value ?? ''), cellEditor: 'agLargeTextCellEditor', cellEditorPopup: true, cellEditorPopupPosition: 'over', cellEditorParams: { rows: 8, cols: 60, maxLength: 4000 }, filter: 'agSetColumnFilter', filterParams: { valueFormatter: (p: any) => { const raw = String(p.value ?? '').replace(/\r?\n/g, ' ').trim(); return raw.length > 50 ? raw.slice(0, 49) + '…' : raw; } } },
    { field: 'WeekStartDay', headerName: String(t('shipmentPlanFact.WeekStartDay')), width: 130, minWidth: 120, editable: false, cellDataType: 'date', cellClass: 'text-center', valueGetter: (p: any) => { const d = new Date(p.data?.WeekStartDay); return isNaN(d.getTime()) ? null : d; }, valueFormatter: (p: any) => fmtDate(p.value) },
    { field: 'WeekFinishDay', headerName: String(t('shipmentPlanFact.WeekFinishDay')), width: 130, minWidth: 120, editable: false, cellDataType: 'date', cellClass: 'text-center', valueGetter: (p: any) => { const d = new Date(p.data?.WeekFinishDay); return isNaN(d.getTime()) ? null : d; }, valueFormatter: (p: any) => fmtDate(p.value) },
  ], [editMode, t]);

  const defaultColDef = useMemo<ColDef>(() => ({
    resizable: true, sortable: true, filter: true, editable: true,
  }), []);

  // Focus mode height like Loss Table: compute available height when body has 'app-focus'
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
    const obs = new MutationObserver(compute);
    if (typeof document !== 'undefined') {
      obs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }
    return () => { window.removeEventListener('resize', compute); obs.disconnect(); };
  }, []);
  const components = useMemo(() => ({ commentTooltip: CommentTooltip }), []);

  // Copy to clipboard: use raw numeric values (no thousand separators) and ISO dates
  const processCellForClipboard = useCallback((p: any) => {
    try {
      const colDef = p?.column?.getColDef?.();
      const field: string | undefined = colDef?.field;
      if (!field) return p?.value;
      const raw = p?.node?.data?.[field];
      if (colDef?.cellDataType === 'number') {
        const n = Number(raw);
        return Number.isFinite(n) ? n : (raw ?? '');
      }
      if (colDef?.cellDataType === 'date') {
        const d = new Date(raw);
        return isNaN(d.getTime()) ? (raw ?? '') : d.toISOString().slice(0, 10);
      }
      return raw ?? '';
    } catch {
      return p?.value;
    }
  }, []);

  if (loading || !isReadyToShow) return <LoadingSpinner overlay="screen" size="xl" />;
  if (error) return <div className="text-red-600">{error}</div>;

  const actions = (
    <div className="flex items-center gap-2">
      <button
        onClick={() => { setConfirmState({ open: true, message: String(t('shipmentPlanFact.confirmRefresh')), onOk: () => reload(), danger: false }); }}
        title={String(t('ui.refresh'))}
        aria-label={'Refresh'}
        className="h-8 w-8 p-2 rounded-md border border-gray-300 bg-white text-slate-700 hover:bg-gray-100 flex items-center justify-center"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><path d="M17.65 6.35A7.95 7.95 0 0 0 12 4V1L7 6l5 5V7a5 5 0 1 1-4.9 6.09 1 1 0 0 0-1.96.24A7 7 0 1 0 17.65 6.35Z"/></svg>
      </button>
      <AgGridExportButton api={gridApi} fileName="shipment_plan_fact" variant="icon" />
      <FocusModeToggle variant="dark" />
      <EditModeToggle on={editMode} onToggle={() => setEditMode(v => !v)} title={String(t('ui.settings'))} />
      <button
        onClick={() => { if (hasDirty) setConfirmState({ open: true, message: `${String(t('shipmentPlanFact.confirmSave'))}${hasDirty ? '' : ''}`, onOk: () => saveDirty(), danger: false }); }}
        title={hasDirty ? 'Save' : 'No changes to save'}
        aria-label="Save"
        disabled={!hasDirty}
        className={`h-8 w-8 p-2 rounded-md border flex items-center justify-center ${hasDirty ? (editMode ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-white text-emerald-600 hover:bg-emerald-50') : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><path d="M17 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7l-4-4Zm-5 16a3 3 0 1 1 0-6 3 3 0 0 1 0 6Zm3-10H5V5h10v4Z"/></svg>
      </button>
    </div>
  );

  const actionsSlot = typeof document !== 'undefined' ? document.getElementById('shipment-actions-slot') : null;

  return (
    <div className="space-y-3">
      {actionsSlot ? createPortal(actions, actionsSlot) : (<div className="flex items-center justify-between">{actions}</div>)}
      <ConfirmDialog
        open={confirmState.open}
        message={confirmState.message}
        danger={confirmState.danger}
        onOk={() => { const ok = confirmState.onOk; setConfirmState({ open: false, message: '', onOk: () => {}, danger: false }); ok && ok(); }}
        onCancel={() => setConfirmState({ open: false, message: '', onOk: () => {}, danger: false })}
      />
      <div ref={gridWrapperRef} className="ag-theme-quartz ag-grid-bordered" style={{ width: '100%', height: gridHeightPx != null ? `${gridHeightPx}px` : '78vh' }}>
        <AgGridReact<Row>
          onGridReady={(p) => { gridApiRef.current = p.api; setGridApi(p.api); }}
          rowData={rows}
          columnDefs={columns}
          defaultColDef={defaultColDef}
          getRowId={(p: { data: Row }) => p.data._lid}
          components={components}
          tooltipShowDelay={300}
          tooltipHideDelay={100000}
          tooltipMouseTrack={true}
          popupParent={typeof document !== 'undefined' ? (document.body as any) : undefined}
          onCellValueChanged={onCellValueChanged}
          cellSelection={true}
          suppressClipboardPaste={false}
          enableCellTextSelection={false}
          processCellForClipboard={processCellForClipboard}
          statusBar={{
            statusPanels: [
              { statusPanel: 'agAggregationComponent', align: 'left', statusPanelParams: { aggFuncs: ['sum','min','max','avg','count'] } }
            ]
          }}
          groupIncludeTotalFooter={false}
        />
      </div>
    </div>
  );
};

export default ShipmentPlanFactTable;


