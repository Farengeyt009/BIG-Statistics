import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import type { ColDef, CellValueChangedEvent } from '@ag-grid-community/core';
import { AgGridReact } from '@ag-grid-community/react';
// регистрация вынесена в src/ag-grid-modules.ts и импортируется один раз в main.tsx
import '@ag-grid-community/styles/ag-grid.css';
import '@ag-grid-community/styles/ag-theme-quartz.css';
import {
  apiAddRow,
  apiGetDicts,
  apiGetRows,
  apiGetRowsRange,
  apiPatchCell,
  apiSoftDelete,
} from '../../../../config/timeloss-api';

export type TimeLossRow = {
  EntryID: number;
  OnlyDate: string;
  WorkShopID: string;
  WorkCenterID: string;
  DirectnessID: number;
  ReasonGroupID: number | null;
  CommentText: string | null;
  ManHours: number | null;
  ActionPlan: string | null;
  Responsible: string | null;
  CompletedDate: string | null;
};

type LocalRow = TimeLossRow & {
  _lid: string;
  _isNew?: boolean;
  _isDeleted?: boolean;
  _dirty?: Set<keyof TimeLossRow>;
};

type DictItem = { value: string | number; label: string; labelEn?: string; labelZh?: string };

type Dicts = {
  workshops: DictItem[];
  workcentersByWS: Record<string, DictItem[]>;
  directness: DictItem[];
  reasonGroupsByWS: Record<string, DictItem[]>;
};

type Props = {
  date?: string;
  startDate?: string;
  endDate?: string;
  initialWorkShop?: string;
  selectedWorkShopIds?: string[];
};

const mkId = () => Math.random().toString(36).slice(2);

// AG Grid modules are registered once in src/ag-grid-modules.ts (imported in main.tsx)

const normalizeDate = (value: any): string | null => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const isoMatch = value.match(/^\d{4}-\d{2}-\d{2}/);
    if (isoMatch) return isoMatch[0];
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return value;
  }
  const d = new Date(value);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return String(value);
};

const getDictLabel = (o: DictItem | undefined | null, lang: string): string => {
  if (!o) return '';
  if (lang?.startsWith('en')) return o.labelEn ?? o.label;
  if (lang?.startsWith('zh')) return o.labelZh ?? o.label;
  return o.labelEn ?? o.labelZh ?? o.label;
};

function buildWSWCDicts(raw: any): { workshops: DictItem[]; workcentersByWS: Record<string, DictItem[]> } {
  let list: any[] = [];
  if (Array.isArray(raw?.Ref?.WorkShop_CustomWS)) list = raw.Ref.WorkShop_CustomWS;
  else if (Array.isArray(raw?.WorkShop_CustomWS)) list = raw.WorkShop_CustomWS;
  else if (Array.isArray((raw as any)?.['Ref.WorkShop_CustomWS'])) list = (raw as any)['Ref.WorkShop_CustomWS'];
  else if (Array.isArray(raw?.ref?.WorkShop_CustomWS)) list = raw.ref.WorkShop_CustomWS;

  const wsMap = new Map<string, DictItem>();
  const wcByWs: Record<string, DictItem[]> = {};
  for (const rec of list) {
    const wsId = String(rec?.WorkShop_CustomWS ?? rec?.WorkShopID ?? rec?.WorkShop ?? '');
    const wcId = String(rec?.WorkCenter_CustomWS ?? rec?.WorkCenterID ?? rec?.WorkCenter ?? '');
    if (wsId && !wsMap.has(wsId)) {
      wsMap.set(wsId, {
        value: wsId,
        label: rec?.WorkShopName_EN || rec?.WorkShopName_ZH || wsId,
        labelEn: rec?.WorkShopName_EN,
        labelZh: rec?.WorkShopName_ZH,
      });
    }
    if (wsId && wcId) {
      wcByWs[wsId] ??= [];
      if (!wcByWs[wsId].some(x => String(x.value) === wcId)) {
        wcByWs[wsId].push({
          value: wcId,
          label: rec?.WorkCenterName_EN || rec?.WorkCenterName_ZH || wcId,
          labelEn: rec?.WorkCenterName_EN,
          labelZh: rec?.WorkCenterName_ZH,
        });
      }
    }
  }
  return { workshops: Array.from(wsMap.values()), workcentersByWS: wcByWs };
}

const TimeLossTable: React.FC<Props> = ({ date, startDate, endDate, initialWorkShop, selectedWorkShopIds }) => {
  const { t, i18n } = useTranslation('production');
  const lang = i18n.language || 'zh';
  const gridApiRef = useRef<any>(null);
  const copiedCellsRef = useRef<Set<string>>(new Set());

  const [dicts, setDicts] = useState<Dicts | null>(null);
  const [rows, setRows] = useState<LocalRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const loadRows = async (): Promise<TimeLossRow[]> => {
        if (startDate && endDate) return apiGetRowsRange(startDate, endDate);
        const d = date || startDate || new Date().toISOString().slice(0, 10);
        return apiGetRows(d);
      };
      const [rawDicts, r] = await Promise.all([apiGetDicts(), loadRows()]);
      const { workshops, workcentersByWS } = buildWSWCDicts(rawDicts);
      const dictsFinal: Dicts = {
        workshops: (workshops?.length ? workshops : (rawDicts.workshops ?? [])),
        workcentersByWS: (Object.keys(workcentersByWS || {}).length ? workcentersByWS : (rawDicts.workcentersByWS ?? {})),
        directness: rawDicts.directness ?? [],
        reasonGroupsByWS: rawDicts.reasonGroupsByWS ?? {},
      };
      setDicts(dictsFinal);
      setRows(
        r.map(x => ({
          ...x,
          OnlyDate: normalizeDate(x.OnlyDate) ?? '',
          CompletedDate: normalizeDate(x.CompletedDate),
          _lid: mkId(),
        }))
      );
      setError(null);
    } catch (e: any) {
      setError(e.message ?? 'Load error');
    } finally {
      setLoading(false);
    }
  }, [date, startDate, endDate]);

  useEffect(() => { reload(); }, [reload]);

  const filteredRows = useMemo(() => {
    if (!selectedWorkShopIds || !selectedWorkShopIds.length) return rows;
    const set = new Set(selectedWorkShopIds.map(String));
    // Показываем новые строки всегда, даже если WorkShopID ещё не выбран
    return rows.filter(r => (r as LocalRow)._isNew || set.has(String(r.WorkShopID)));
  }, [rows, selectedWorkShopIds]);

  const markDirty = useCallback((rid: string, field: keyof TimeLossRow, value: any) => {
    setRows(prev => prev.map(r => {
      if (r._lid !== rid) return r;
      const dirty = new Set(r._dirty ?? []);
      dirty.add(field);
      return { ...r, [field]: value, _dirty: dirty } as LocalRow;
    }));
  }, []);

  const onCellValueChanged = useCallback((ev: CellValueChangedEvent<LocalRow>) => {
    const colId = ev.colDef.field as keyof TimeLossRow | undefined;
    if (!colId) return;
    markDirty(ev.data._lid, colId, ev.newValue);
  }, [markDirty]);

  const addRow = useCallback(() => {
    const todayIso = new Date().toISOString().slice(0, 10);
    const dir = Number(dicts?.directness?.[0]?.value ?? 1);
    const r: LocalRow = {
      _lid: mkId(),
      _isNew: true,
      _dirty: new Set<keyof TimeLossRow>(['OnlyDate','WorkShopID','WorkCenterID','DirectnessID','ReasonGroupID','ManHours']),
      EntryID: 0,
      OnlyDate: todayIso,
      WorkShopID: '',
      WorkCenterID: '' as any,
      ReasonGroupID: null,
      DirectnessID: dir,
      CommentText: null,
      ManHours: null,
      ActionPlan: null,
      Responsible: null,
      CompletedDate: null,
    };
    setRows(prev => [r, ...prev]);
  }, [dicts]);

  const toggleDelete = useCallback((rid: string) => {
    setRows(prev => prev.map(r => r._lid === rid ? { ...r, _isDeleted: !r._isDeleted } : r));
  }, []);

  const saveAll = useCallback(async () => {
    const toCreate = rows.filter(r => r._isNew && !r._isDeleted);
    const toUpdate = rows.filter(r => !r._isNew && !r._isDeleted && r._dirty && r._dirty.size > 0);
    const toDelete = rows.filter(r => !r._isNew && r._isDeleted);

    const required: (keyof TimeLossRow)[] = ['OnlyDate','WorkShopID','WorkCenterID','DirectnessID','ReasonGroupID','ManHours'];
    const bad = [...toCreate, ...toUpdate].find(r => required.some(k => (r as any)[k] === null || (r as any)[k] === '' || (r as any)[k] === undefined));
    if (bad) { setError('Заполните обязательные поля'); return; }

    try {
      for (const r of toDelete) await apiSoftDelete(r.EntryID);

      const created: LocalRow[] = [];
      for (const r of toCreate) {
        const payload: Partial<TimeLossRow> = {
          OnlyDate: r.OnlyDate,
          WorkShopID: r.WorkShopID,
          WorkCenterID: r.WorkCenterID,
          DirectnessID: r.DirectnessID,
          ReasonGroupID: r.ReasonGroupID,
          ManHours: r.ManHours,
          CommentText: r.CommentText,
          ActionPlan: r.ActionPlan,
          Responsible: r.Responsible,
          CompletedDate: r.CompletedDate,
        };
        const db = await apiAddRow(payload as any);
        created.push({ ...(db as TimeLossRow), _lid: r._lid });
      }

      for (const r of toUpdate) {
        for (const f of r._dirty!) await apiPatchCell(r.EntryID, f, (r as any)[f]);
      }

      setRows(prev => prev
        .filter(r => !(r._isNew && r._isDeleted))
        .map(r => {
          if (r._isDeleted && !r._isNew) return null as any;
          const createdMatch = created.find(c => c._lid === r._lid);
          if (createdMatch) return { ...createdMatch, _dirty: new Set(), _isNew: false } as LocalRow;
          if (r._dirty && r._dirty.size > 0) return { ...r, _dirty: new Set() } as LocalRow;
          return r;
        })
        .filter(Boolean) as LocalRow[]);

      setError(null);
    } catch (e: any) {
      setError(e.message ?? 'Save failed');
    }
  }, [rows]);

  const actions = (
    <div className="flex items-center gap-2">
      <button onClick={saveAll} className="px-4 py-1 rounded-md text-sm font-medium border bg-emerald-600 text-white hover:bg-emerald-700">{t('timeLossTable.save')}</button>
      <button onClick={addRow} className="px-4 py-1 rounded-md text-sm font-medium border transition-colors bg-[#0d1c3d] text-white border-[#0d1c3d] hover:bg-[#0b1733]">{t('timeLossTable.addRow')}</button>
      <button onClick={reload} className="px-4 py-1 rounded-md text-sm font-medium border transition-colors bg-[#0d1c3d] text-white border-[#0d1c3d] hover:bg-[#0b1733]">{t('timeLossTable.refresh')}</button>
    </div>
  );

  const actionsSlot = typeof document !== 'undefined' ? document.getElementById('tl-actions-slot') : null;

  const directnessValues = useMemo(() => (dicts?.directness ?? []).map(d => String(d.value)), [dicts]);
  const reasonByWs = useMemo(() => dicts?.reasonGroupsByWS ?? {}, [dicts]);
  const wcByWs = useMemo(() => dicts?.workcentersByWS ?? {}, [dicts]);

  // Helpers for fast Set Filters over reference columns
  const findByValue = useCallback((arr: DictItem[] | undefined, val: any): DictItem | undefined => {
    return (arr ?? []).find(o => String(o.value) === String(val));
  }, []);

  const wsFilterValues = useMemo(() => (dicts?.workshops ?? []).map(w => String(w.value)), [dicts]);
  const directnessFilterValues = useMemo(() => (dicts?.directness ?? []).map(d => String(d.value)), [dicts]);
  const reasonFilterValues = useMemo(() => {
    const s = new Set<string>();
    const map = reasonByWs || {} as Record<string, DictItem[]>;
    Object.values(map).forEach(arr => (arr || []).forEach(i => s.add(String(i.value))));
    return Array.from(s);
  }, [reasonByWs]);

  // Глобальная карта РЦ (ID -> отображаемое имя), чтобы SetFilter мог показывать метки без привязки к строке
  const wcValueToLabel = useMemo(() => {
    const m = new Map<string, string>();
    const map = wcByWs || {} as Record<string, DictItem[]>;
    Object.values(map).forEach(arr => (arr || []).forEach(i => {
      const k = String(i.value);
      if (!m.has(k)) m.set(k, getDictLabel(i, lang));
    }));
    return m;
  }, [wcByWs, lang]);

  // Lists for Set Filters on non-reference columns
  const onlyDateValues = useMemo(() => {
    const s = new Set<string>();
    rows.forEach(r => { const v = r.OnlyDate; if (v) s.add(String(v)); });
    return Array.from(s);
  }, [rows]);

  const workCenterLabelValues = useMemo(() => {
    const s = new Set<string>();
    rows.forEach(r => {
      const ws = String(r.WorkShopID ?? '');
      const opts = wcByWs[ws] ?? [];
      const lbl = getDictLabel(opts.find(o => String(o.value) === String(r.WorkCenterID)), lang);
      if (lbl) s.add(lbl);
    });
    return Array.from(s);
  }, [rows, wcByWs, lang]);

  const commentValues = useMemo(() => {
    const s = new Set<string>();
    rows.forEach(r => { const v = (r.CommentText ?? '').toString().trim(); if (v && v.toLowerCase() !== 'nan') s.add(v); });
    return Array.from(s);
  }, [rows]);

  const actionPlanValues = useMemo(() => {
    const s = new Set<string>();
    rows.forEach(r => { const v = (r.ActionPlan ?? '').toString().trim(); if (v && v.toLowerCase() !== 'nan') s.add(v); });
    return Array.from(s);
  }, [rows]);

  const responsibleValues = useMemo(() => {
    const s = new Set<string>();
    rows.forEach(r => { const v = (r.Responsible ?? '').toString().trim(); if (v && v.toLowerCase() !== 'nan') s.add(v); });
    return Array.from(s);
  }, [rows]);

  const completedDateValues = useMemo(() => {
    const s = new Set<string>();
    rows.forEach(r => { const v = r.CompletedDate ? String(r.CompletedDate) : ''; if (v) s.add(v); });
    return Array.from(s);
  }, [rows]);

  const manHoursValues = useMemo(() => {
    const s = new Set<string>();
    rows.forEach(r => {
      const v = r.ManHours;
      if (v === null || v === undefined) return;
      const n = Number(v);
      if (!isFinite(n)) return;
      const text = new Intl.NumberFormat(undefined, { maximumFractionDigits: 6 }).format(n);
      s.add(text);
    });
    return Array.from(s);
  }, [rows]);

  const columns = useMemo<ColDef<LocalRow>[]>(() => [
    { field: 'OnlyDate', headerName: t('timeLossTable.date') as string, editable: true, filter: 'agSetColumnFilter', width: 140,
      filterParams: { values: onlyDateValues, includeBlanksInFilter: true },
    },
    { field: 'WorkShopID', headerName: t('timeLossTable.workshop') as string, editable: true, filter: 'agSetColumnFilter', width: 160,
      filterParams: {
        values: wsFilterValues,
        valueFormatter: (p: any) => getDictLabel(findByValue(dicts?.workshops, p.value), lang),
        includeBlanksInFilter: true,
      },
      cellEditor: 'agRichSelectCellEditor',
      cellEditorParams: () => ({
        values: (dicts?.workshops ?? []).map(w => String(w.value)),
        formatValue: (id: any) => getDictLabel((dicts?.workshops ?? []).find(w => String(w.value) === String(id)), lang),
        searchDebounceDelay: 0,
      }),
      valueFormatter: params => getDictLabel((dicts?.workshops ?? []).find(w => String(w.value) === String(params.value)), lang),
    },
    { field: 'WorkCenterID', headerName: t('timeLossTable.workCenter') as string, editable: true, filter: 'agSetColumnFilter', width: 200,
      filterParams: {
        includeBlanksInFilter: true,
        keyCreator: (p: any) => wcValueToLabel.get(String(p.value)) || '',
        valueFormatter: (p: any) => wcValueToLabel.get(String(p.value)) || '',
      },
      cellEditor: 'agRichSelectCellEditor',
      cellEditorParams: (p: any) => ({
        values: (wcByWs[p?.data?.WorkShopID] ?? []).map(w => String(w.value)),
        formatValue: (id: any) => { const ws = p?.data?.WorkShopID; const opts = wcByWs[ws] ?? []; return getDictLabel(opts.find(o => String(o.value) === String(id)), lang); },
        searchDebounceDelay: 0,
      }),
      valueFormatter: params => { const ws = (params.data as LocalRow)?.WorkShopID; const opts = wcByWs[ws] ?? []; return getDictLabel(opts.find(o => String(o.value) === String(params.value)), lang); },
    },
    { field: 'DirectnessID', headerName: t('timeLossTable.lossType') as string, editable: true, filter: 'agSetColumnFilter', width: 160,
      filterParams: {
        values: directnessFilterValues,
        valueFormatter: (p: any) => getDictLabel(findByValue(dicts?.directness as any, p.value), lang),
        includeBlanksInFilter: true,
      },
      cellEditor: 'agRichSelectCellEditor', cellEditorParams: { values: directnessValues, formatValue: (id: any) => getDictLabel((dicts?.directness ?? []).find(o => String(o.value) === String(id)), lang) },
      valueParser: p => (p.newValue == null || p.newValue === '') ? null : Number(p.newValue),
      valueFormatter: params => getDictLabel((dicts?.directness ?? []).find(o => Number(o.value) === Number(params.value)), lang),
    },
    { field: 'ReasonGroupID', headerName: t('timeLossTable.lossReason') as string, editable: true, filter: 'agSetColumnFilter', width: 200,
      filterParams: {
        values: reasonFilterValues,
        valueFormatter: (p: any) => {
          // формат по любому справочнику
          const all: DictItem[] = ([] as DictItem[]).concat(...Object.values(reasonByWs || {} as Record<string, DictItem[]>));
          return getDictLabel(findByValue(all, p.value), lang);
        },
        includeBlanksInFilter: true,
      },
      cellEditor: 'agRichSelectCellEditor',
      cellEditorParams: (p: any) => ({
        values: (reasonByWs[p?.data?.WorkShopID] ?? []).map(r => String(r.value)),
        formatValue: (id: any) => { const ws = p?.data?.WorkShopID; const opts = reasonByWs[ws] ?? []; return getDictLabel(opts.find(o => String(o.value) === String(id)), lang); },
        searchDebounceDelay: 0,
      }),
      valueParser: p => (p.newValue == null || p.newValue === '') ? null : Number(p.newValue),
      valueFormatter: params => { const ws = (params.data as LocalRow)?.WorkShopID; const opts = reasonByWs[ws] ?? []; return getDictLabel(opts.find(o => Number(o.value) === Number(params.value)), lang); },
    },
    { field: 'CommentText', headerName: t('timeLossTable.comment') as string, editable: true, filter: 'agSetColumnFilter', wrapText: true, autoHeight: true, width: 460,
      filterParams: { values: commentValues, includeBlanksInFilter: true },
      valueFormatter: p => { const v = p.value; if (v == null || v === '') return ''; const s = String(v).trim(); return s.toLowerCase() === 'nan' ? '' : s; },
      cellEditor: 'agLargeTextCellEditor', cellEditorParams: { maxLength: 1000, rows: 6, cols: 40 },
    },
    { field: 'ManHours', headerName: t('timeLossTable.manHours') as string, editable: true, filter: 'agSetColumnFilter', width: 120,
      filterParams: {
        includeBlanksInFilter: true,
        keyCreator: (p: any) => {
          const v = p.value;
          if (v === null || v === undefined) return '';
          const n = Number(v);
          if (!isFinite(n)) return '';
          return new Intl.NumberFormat(undefined, { maximumFractionDigits: 6 }).format(n);
        },
        valueFormatter: (p: any) => {
          const v = p.value;
          if (v === null || v === undefined) return '';
          const n = Number(v);
          if (!isFinite(n)) return '';
          return new Intl.NumberFormat(undefined, { maximumFractionDigits: 6 }).format(n);
        },
      },
      valueParser: p => { const s = String(p.newValue ?? '').replace(',', '.'); if (s === '') return null; const n = Number(s); return isNaN(n) ? null : n; },
      valueFormatter: params => {
        const v = params.value;
        if (v === null || v === undefined || v === '') return '';
        if (typeof v === 'string' && v.trim().toLowerCase() === 'nan') return '';
        const n = Number(v);
        if (!isFinite(n)) return '';
        return new Intl.NumberFormat(undefined, { maximumFractionDigits: 6 }).format(n);
      },
    },
    { field: 'ActionPlan', headerName: t('timeLossTable.actionPlan') as string, editable: true, filter: 'agSetColumnFilter', wrapText: true, autoHeight: true, width: 360,
      filterParams: { values: actionPlanValues, includeBlanksInFilter: true },
      valueFormatter: p => { const v = p.value; if (v == null || v === '') return ''; const s = String(v).trim(); return s.toLowerCase() === 'nan' ? '' : s; },
      cellEditor: 'agLargeTextCellEditor', cellEditorParams: { maxLength: 1000, rows: 6, cols: 40 },
    },
    { field: 'Responsible', headerName: t('timeLossTable.responsible') as string, editable: true, filter: 'agSetColumnFilter', width: 160,
      filterParams: { values: responsibleValues, includeBlanksInFilter: true },
      valueFormatter: p => { const v = p.value; if (v == null || v === '') return ''; const s = String(v).trim(); return s.toLowerCase() === 'nan' ? '' : s; },
    },
    { field: 'CompletedDate', headerName: t('timeLossTable.completedDate') as string, editable: true, filter: 'agSetColumnFilter', width: 160,
      filterParams: { values: completedDateValues, includeBlanksInFilter: true },
      valueFormatter: p => { const v = p.value; if (v == null || v === '') return ''; const s = String(v).trim(); return s.toLowerCase() === 'nan' ? '' : s; },
    },
    { headerName: '', width: 60, editable: false, filter: false, cellRenderer: (p: any) => (
      <button className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors" title={p.data?._isDeleted ? (t('timeLossTable.undo')||'Undo') : (t('timeLossTable.delete')||'Delete')} onClick={() => toggleDelete((p.data as LocalRow)._lid)}>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
      </button>
    )},
  ], [t, lang, dicts, wcByWs, reasonByWs, directnessValues, toggleDelete]);

  const defaultColDef = useMemo<ColDef>(() => ({
    resizable: true,
    sortable: true,
    filter: true,
    editable: true,
    cellClassRules: {
      'copied-cell': params => copiedCellsRef.current.has(`${(params.data as LocalRow)?._lid}|${params.colDef.field}`),
    },
  }), []);

  // Корректная обработка вставки из буфера для select-колонок: принимать метки и конвертировать в ID
  const processCellFromClipboard = useCallback((p: any) => {
    const colId = p?.column?.getColDef?.()?.field as keyof TimeLossRow | undefined;
    const raw = p?.value;
    if (!colId) return raw;
    const normalize = (v: any): string => String(v ?? '').trim();
    const isEmpty = (s: string) => s === '' || s.toLowerCase() === 'nan';

    const text = normalize(raw);
    if (isEmpty(text)) return null;

    // helpers to find by label or value
    const matchItem = (items: DictItem[] | undefined, s: string): string | number | null => {
      if (!items || !items.length) return null;
      const byValue = items.find(i => String(i.value) === s);
      if (byValue) return byValue.value;
      const byLabel = items.find(i => {
        const lbl = getDictLabel(i, lang);
        return String(lbl).trim() === s;
      });
      return byLabel ? byLabel.value : null;
    };

    if (colId === 'WorkShopID') {
      const id = matchItem(dicts?.workshops, text);
      return id != null ? String(id) : null;
    }
    if (colId === 'WorkCenterID') {
      const ws = p?.node?.data?.WorkShopID ? String(p.node.data.WorkShopID) : undefined;
      const items = ws ? wcByWs[ws] : undefined;
      const id = matchItem(items, text);
      return id != null ? String(id) : null;
    }
    if (colId === 'DirectnessID') {
      const id = matchItem(dicts?.directness as any, text);
      return id != null ? Number(id) : null;
    }
    if (colId === 'ReasonGroupID') {
      const ws = p?.node?.data?.WorkShopID ? String(p.node.data.WorkShopID) : undefined;
      const items = ws ? reasonByWs[ws] : undefined;
      const id = matchItem(items as any, text);
      return id != null ? Number(id) : null;
    }
    if (colId === 'ManHours') {
      const s = text.replace(',', '.');
      if (s === '') return null;
      const n = Number(s);
      return isNaN(n) ? null : n;
    }
    // остальные поля — как есть
    return raw;
  }, [dicts, wcByWs, reasonByWs, lang]);

  const markCurrentSelectionFromApi = useCallback((api: any) => {
    if (!api?.getCellRanges) return;
    const ranges: any[] = api.getCellRanges() || [];
    const set = new Set<string>();
    for (const r of ranges) {
      const cols: any[] = r?.columns || [];
      const start = r?.startRow?.rowIndex ?? r?.startRowIndex ?? 0;
      const end = r?.endRow?.rowIndex ?? r?.endRowIndex ?? start;
      for (let ri = Math.min(start, end); ri <= Math.max(start, end); ri++) {
        const node = api?.getDisplayedRowAtIndex?.(ri);
        const lid = node?.data?._lid;
        if (!lid) continue;
        for (const c of cols) {
          const field = c?.getColDef?.()?.field;
          if (field) set.add(`${lid}|${field}`);
        }
      }
    }
    if (set.size) {
      copiedCellsRef.current = set;
      api?.refreshCells?.({ force: true, suppressFlash: true });
    }
  }, []);

  if (loading) return <div className="flex justify-center items-center h-64 text-gray-600">加载中… / Загрузка…</div>;
  if (error) return <div className="flex justify-center items-center h-64 text-red-600">{error}</div>;

  const totalManHours = filteredRows.reduce((s, r) => s + (Number(r.ManHours) || 0), 0);

  return (
    <div className="space-y-3">
      {actionsSlot ? createPortal(actions, actionsSlot) : (<div className="flex items-center justify-between">{actions}</div>)}
      <div className="ag-theme-quartz" style={{ width: '100%', height: '78vh' }}>
        <AgGridReact<LocalRow>
          onGridReady={(p) => { gridApiRef.current = p.api; }}
          rowData={filteredRows}
          columnDefs={columns}
          defaultColDef={defaultColDef}
          onCellValueChanged={onCellValueChanged}
          onCellKeyDown={(e: any) => {
            const ke = e.event as KeyboardEvent;
            if ((ke.ctrlKey || ke.metaKey) && String(ke.key).toLowerCase() === 'c') {
              markCurrentSelectionFromApi(e.api);
              return;
            }
            if (String(ke.key) === 'Escape') {
              if (copiedCellsRef.current.size) {
                copiedCellsRef.current.clear();
                e.api.refreshCells?.({ force: true, suppressFlash: true });
              }
            }
          }}
          onCellDoubleClicked={() => { if (copiedCellsRef.current.size) { copiedCellsRef.current.clear(); gridApiRef.current?.refreshCells?.({ force: true, suppressFlash: true }); } }}
          // Excel-like selection/clipboard (Enterprise)
          getRowId={(p: { data: LocalRow }) => p.data._lid}
          cellSelection={true}
          suppressClipboardPaste={false}
          sendToClipboard={(p: any) => {
            try { (navigator as any)?.clipboard?.writeText?.(p.data); } catch {}
            const api: any = gridApiRef.current;
            markCurrentSelectionFromApi(api);
          }}
          processCellFromClipboard={processCellFromClipboard}
          suppressDragLeaveHidesColumns={true}
          statusBar={{
            statusPanels: [
              {
                statusPanel: 'agAggregationComponent',
                statusPanelParams: { aggFuncs: ['count','sum','min','max','avg'] },
                align: 'left',
              },
            ],
          }}
          rowClassRules={{ 'line-through opacity-50': (p: any) => !!(p.data as LocalRow)?._isDeleted }}
        />
      </div>
      <div className="px-2 py-1 text-sm text-slate-600">{(t('total') as string) || '合计'}: <span className="font-semibold">{totalManHours.toFixed(1)}</span></div>
    </div>
  );
};

export default TimeLossTable;
