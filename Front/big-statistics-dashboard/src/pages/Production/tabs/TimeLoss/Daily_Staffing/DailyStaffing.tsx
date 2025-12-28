import React, { useEffect, useMemo, useState, useRef, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { apiGetDailyStaffing, DailyStaffingRow } from '../../../../../config/timeloss-api';
import AgGridExportButton from '../../../../../components/AgGrid/ExportButton';
import FocusModeToggle from '../../../../../components/focus/FocusModeToggle';
import LoadingSpinner from '../../../../../components/ui/LoadingSpinner';
import { AgGridReact } from '@ag-grid-community/react';
import type { ColDef } from '@ag-grid-community/core';
import '@ag-grid-community/styles/ag-grid.css';
import '@ag-grid-community/styles/ag-theme-quartz.css';
import { applyStandardFilters } from '../../../../../components/AgGrid/filterUtils';

type Props = {
  startDate?: string;
  endDate?: string;
  suppressLocalLoaders?: boolean;
  onLoadingChange?: (loading: boolean) => void;
  isActive?: boolean;
};

const DailyStaffing: React.FC<Props> = ({ startDate, endDate, suppressLocalLoaders, onLoadingChange, isActive }) => {
  const { t, i18n } = useTranslation('production');
  const lang = (i18n.language as 'en' | 'zh' | 'ru') || 'en';

  const [rows, setRows] = useState<DailyStaffingRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isReadyToShow, setIsReadyToShow] = useState(false);
  const renderTimeoutRef = useRef<number | null>(null);

  const gridRef = useRef<HTMLDivElement | null>(null);
  const [gridHeightPx, setGridHeightPx] = useState<number | null>(null);
  const [gridApi, setGridApi] = useState<any | null>(null);
  const copied = useRef<Set<string>>(new Set());

  const dateFrom = startDate || new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
  const dateTo = endDate || new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (!isActive) return;
    const load = async () => {
      setLoading(true);
      onLoadingChange?.(true);
      setError(null);
      try {
        const data = await apiGetDailyStaffing(dateFrom, dateTo);
        setRows(data || []);
      } catch (e: any) {
        setError(e.message || 'Load failed');
      } finally {
        setLoading(false);
        onLoadingChange?.(false);
      }
    };
    load();
  }, [dateFrom, dateTo, isActive]);

  useLayoutEffect(() => {
    const compute = () => {
      const el = gridRef.current;
      if (!el) return;
      const isFocus = typeof document !== 'undefined' && document.body.classList.contains('app-focus');
      if (!isFocus) {
        // В обычном режиме используем фиксированную высоту через CSS (78vh)
        setGridHeightPx(null);
        return;
      }
      const top = el.getBoundingClientRect().top;
      // В фокус-режиме оставляем разумный запас снизу
      const bottomReserve = 48;
      const h = Math.max(200, Math.floor(window.innerHeight - top - bottomReserve));
      setGridHeightPx(h);
      try { gridApi?.sizeColumnsToFit?.(); } catch {}
    };
    compute();
    window.addEventListener('resize', compute);
    const obs = new MutationObserver(compute);
    if (typeof document !== 'undefined') {
      obs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }
    return () => { window.removeEventListener('resize', compute); obs.disconnect(); };
  }, [gridApi]);

  const fmtInt = useMemo(() => new Intl.NumberFormat(undefined, { maximumFractionDigits: 0, minimumFractionDigits: 0 }), []);
  const fmtNum = useMemo(() => new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }), []);

  const toIso = (s: any): string => {
    if (!s) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(s))) return String(s);
    const d = new Date(s);
    return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
  };

  const processed = useMemo(() => rows.map((r, idx) => ({
    __rid: `${r.OnlyDate}|${r.WorkShopID}|${r.WorkCenterID}|${idx}`,
    OnlyDate: r.OnlyDate,
    OnlyDateISO: toIso(r.OnlyDate),
    WorkShopLabel: (lang === 'zh' ? r.WorkShopName_ZH : r.WorkShopName_EN) || r.WorkShopID,
    WorkCenterLabel: (lang === 'zh' ? r.WorkCenterName_ZH : r.WorkCenterName_EN) || r.WorkCenterID,
    People: r.People ?? null,
    WorkHours: r.WorkHours ?? null,
    PeopleWorkHours: r.PeopleWorkHours ?? ((r.People ?? 0) * (r.WorkHours ?? 0)),
    EntryManHours: r.EntryManHours ?? null,
    EffectiveTime: (r.PeopleWorkHours ?? ((r.People ?? 0) * (r.WorkHours ?? 0))) - (r.EntryManHours ?? 0),
  })), [rows, lang]);

  const getRowId = useCallback((p: any) => p.data.__rid, []);
  const defaultColDef: ColDef = useMemo(() => ({ resizable: true, sortable: true, filter: true, cellClassRules: { 'copied-cell': (params: any) => copied.current.has(`${params.node?.id}|${params.colDef?.field}`) } }), []);

  // Универсальный сборщик значений для SetFilter, учитывающий ВСЕ прочие set-фильтры (кроме самого столбца)
  const collectValuesIgnoringSelf = useCallback(
    (
      params: any,
      colId: 'OnlyDate' | 'WorkShopLabel' | 'WorkCenterLabel',
      valueGetter: (row: any) => string,
      sort?: (a: string, b: string) => number,
    ) => {
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
          const v = f.colId === 'OnlyDate'
            ? String(row?.OnlyDateISO ?? '')
            : String(row?.[f.colId] ?? '').trim();
          if (f.allowed.size && !f.allowed.has(v)) return false;
        }
        return true;
      };

      const uniq = new Set<string>();
      (processed || []).forEach(r => {
        if (!passOtherSetFilters(r)) return;
        const val = valueGetter(r);
        if (val !== undefined && val !== null && String(val).length) uniq.add(String(val));
      });
      const out = Array.from(uniq);
      if (sort) out.sort(sort); else out.sort();
      params.success(out);
    },
    [processed]
  );

  const columnDefs: ColDef[] = useMemo(() => [
    { field: 'OnlyDate', headerName: t('timeLossDailyStaffing.date') as string, minWidth: 90, maxWidth: 200, cellClass: 'text-center',
      valueFormatter: (p: any) => { const s = String(p?.data?.OnlyDateISO || p.value || ''); const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? `${m[3]}.${m[2]}.${m[1]}` : (p.value || ''); },
      filter: 'agSetColumnFilter',
      filterValueGetter: (p: any) => String(p?.data?.OnlyDateISO ?? ''),
      filterParams: {
        treeList: true as any,
        includeBlanksInFilter: true,
        refreshValuesOnOpen: true,
        values: (params: any) => collectValuesIgnoringSelf(params, 'OnlyDate', (r) => String(r.OnlyDateISO || ''), (a,b)=>a.localeCompare(b)),
        treeListPathGetter: (value: any) => {
          const s = String(value ?? '').trim();
          const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
          if (!m) return null;
          const [, y, mm, dd] = m;
          const months = lang === 'zh' ? ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'] : lang === 'ru' ? ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'] : ['January','February','March','April','May','June','July','August','September','October','November','December'];
          return [y, months[Math.max(0, Math.min(11, parseInt(mm,10)-1))], dd];
        },
        valueFormatter: (p: any) => { const s = String(p.value ?? ''); const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? `${m[3]}.${m[2]}.${m[1]}` : s; }
      }
    },
    { field: 'WorkShopLabel', headerName: t('timeLossDailyStaffing.workshop') as string, minWidth: 120, maxWidth: 280, filter: 'agSetColumnFilter',
      filterParams: {
        includeBlanksInFilter: true,
        refreshValuesOnOpen: true,
        values: (params: any) => collectValuesIgnoringSelf(params, 'WorkShopLabel', (r) => String(r.WorkShopLabel ?? '').trim(), (a,b)=>a.localeCompare(b))
      }
    },
    { field: 'WorkCenterLabel', headerName: t('timeLossDailyStaffing.workCenter') as string, minWidth: 120, maxWidth: 280, filter: 'agSetColumnFilter',
      filterParams: {
        includeBlanksInFilter: true,
        refreshValuesOnOpen: true,
        values: (params: any) => collectValuesIgnoringSelf(params, 'WorkCenterLabel', (r) => String(r.WorkCenterLabel ?? '').trim(), (a,b)=>a.localeCompare(b))
      }
    },
    { field: 'People', headerName: t('timeLossDailyStaffing.people') as string, minWidth: 90, maxWidth: 150, cellClass: 'text-center', cellDataType: 'number', valueFormatter: (p: any) => p.value != null ? fmtInt.format(p.value) : '', comparator: (a, b) => Number(a || 0) - Number(b || 0) },
    { field: 'WorkHours', headerName: t('timeLossDailyStaffing.workHours') as string, minWidth: 100, maxWidth: 180, cellClass: 'text-center', cellDataType: 'number', valueFormatter: (p: any) => p.value != null ? fmtNum.format(p.value) : '', comparator: (a, b) => Number(a || 0) - Number(b || 0) },
    { field: 'PeopleWorkHours', headerName: t('timeLossDailyStaffing.peopleWorkHours') as string, minWidth: 120, maxWidth: 200, cellClass: 'text-center', cellDataType: 'number', valueFormatter: (p: any) => p.value != null ? fmtNum.format(p.value) : '', comparator: (a, b) => Number(a || 0) - Number(b || 0) },
    { field: 'EntryManHours', headerName: t('timeLossDailyStaffing.entryManHours') as string, minWidth: 120, maxWidth: 200, cellClass: 'text-center', cellDataType: 'number', valueFormatter: (p: any) => p.value != null ? fmtNum.format(p.value) : '', comparator: (a, b) => Number(a || 0) - Number(b || 0) },
    { field: 'EffectiveTime', headerName: t('timeLossDailyStaffing.effectiveTime') as string, minWidth: 120, maxWidth: 200, cellClass: 'text-center', cellDataType: 'number', valueFormatter: (p: any) => p.value != null ? fmtNum.format(p.value) : '', comparator: (a, b) => Number(a || 0) - Number(b || 0) },
  ], [processed, t, fmtInt, fmtNum, lang]);

  // Применяем стандартные настройки фильтров
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

  if (loading && suppressLocalLoaders) {
    return <div ref={gridRef} className="ag-theme-quartz" style={{ width: '100%', height: gridHeightPx != null ? `${gridHeightPx}px` : '78vh' }} />;
  }
  if (loading || !isReadyToShow) {
    return (
      <LoadingSpinner overlay="screen" size="xl" />
    );
  }
  if (error) {
    return <div className="flex justify-center items-center h-64 text-red-600">{error}</div>;
  }

  // Стратегия авторазмера колонок (по ширине контейнера)
  const autoSizeStrategy = { type: 'fitGridWidth' as const };

  // Действия: рендерим в слот заголовка Time Loss, если доступен
  const actions = (
    <div className="flex items-center gap-2">
      <AgGridExportButton api={gridApi} fileName="daily_staffing" variant="icon" />
      <FocusModeToggle variant="dark" />
    </div>
  );
  const actionsSlot = typeof document !== 'undefined' ? document.getElementById('tl-actions-slot') : null;

  return (
    <div className="space-y-3">
      {actionsSlot ? createPortal(actions, actionsSlot) : (
        <div className="flex items-center gap-2 justify-end w-full px-1">{actions}</div>
      )}
      {/* Контейнер таблицы — ограниченная ширина, прижат слева */}
      <div className="max-w-[1400px] w-full">
        <div ref={gridRef} className="ag-theme-quartz" style={{ width: '100%', height: gridHeightPx != null ? `${gridHeightPx}px` : '78vh' }}>
        <AgGridReact
          rowData={processed}
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
          context={{ gridName: 'daily-staffing' }}
        />
        </div>
      </div>
    </div>
  );
};

export default DailyStaffing;


