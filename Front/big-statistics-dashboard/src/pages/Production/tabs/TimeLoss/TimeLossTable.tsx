import React, { useCallback, useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import type { ColDef, CellValueChangedEvent } from '@ag-grid-community/core';
import { AgGridReact } from '@ag-grid-community/react';
// регистрация вынесена в src/ag-grid-modules.ts и импортируется один раз в main.tsx
import '@ag-grid-community/styles/ag-grid.css';
import '@ag-grid-community/styles/ag-theme-quartz.css';
import ManHoursStatusPanel from './ManHoursStatusPanel';
import AgGridExportButton from '../../../../components/AgGrid/ExportButton';
import FocusModeToggle from '../../../../components/focus/FocusModeToggle';
import EditModeToggle from '../../../../components/AgGrid/EditModeToggle';
import LoadingSpinner from '../../../../components/ui/LoadingSpinner';
import ConfirmDialog from '../../../../components/ui/ConfirmDialog';
import { Trash2 } from 'lucide-react';
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
  RowVer?: string;
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
  suppressLocalLoaders?: boolean;
  onLoadingChange?: (loading: boolean) => void;
  isActive?: boolean;
};

const mkId = () => Math.random().toString(36).slice(2);

// Универсальный парсер числовых значений из текста:
// - удаляет пробелы и неразрывные пробелы
// - удаляет тысячные разделители (',' или '.')
// - последнюю из [, .] трактует как десятичный разделитель
// - возвращает Number или null
function parseNumberFromText(input: any): number | null {
  if (input == null) return null;
  let s = String(input).trim().replace(/\u00A0/g, '');
  if (s === '') return null;
  s = s.replace(/\s/g, '');

  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  const decPos = Math.max(lastComma, lastDot);

  if (decPos >= 0) {
    const intPart = s.slice(0, decPos).replace(/[.,\s]/g, '');
    const fracPart = s.slice(decPos + 1).replace(/[^\d]/g, '');
    s = intPart + '.' + fracPart;
  } else {
    s = s.replace(/[^\d-]/g, '');
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

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

const TimeLossTable: React.FC<Props> = ({ date, startDate, endDate, initialWorkShop, selectedWorkShopIds, suppressLocalLoaders, onLoadingChange, isActive }) => {
  const { t, i18n } = useTranslation('production');
  const lang = i18n.language || 'zh';

  const gridApiRef = useRef<any>(null);
  const [gridApi, setGridApi] = useState<any | null>(null);
  const copiedCellsRef = useRef<Set<string>>(new Set());
  const gridWrapperRef = useRef<HTMLDivElement | null>(null);
  const [gridHeightPx, setGridHeightPx] = useState<number | null>(null);
  const [deleteMode, setDeleteMode] = useState<boolean>(false);
  const [editMode, setEditMode] = useState<boolean>(false);

  const [dicts, setDicts] = useState<Dicts | null>(null);
  const [rows, setRows] = useState<LocalRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  // Валидация: включается после первой неудачной попытки сохранения
  const [validationOn, setValidationOn] = useState<boolean>(false);
  // Map: lid -> (field -> message)
  const [errorsByCell, setErrorsByCell] = useState<Map<string, Map<keyof TimeLossRow, string>>>(new Map());

  const setCellError = useCallback((lid: string, field: keyof TimeLossRow, message: string) => {
    setErrorsByCell(prev => {
      const copy = new Map(prev);
      const rowMap = new Map(copy.get(lid) ?? new Map());
      rowMap.set(field, message);
      copy.set(lid, rowMap);
      return copy;
    });
  }, []);

  const clearCellError = useCallback((lid: string, field: keyof TimeLossRow) => {
    setErrorsByCell(prev => {
      const copy = new Map(prev);
      const rowMap = copy.get(lid);
      if (!rowMap) return copy;
      rowMap.delete(field);
      if (rowMap.size === 0) copy.delete(lid); else copy.set(lid, new Map(rowMap));
      return copy;
    });
  }, []);

  const hasCellError = useCallback((params: any): boolean => {
    const lid = (params?.data as LocalRow)?._lid;
    const field = params?.colDef?.field as keyof TimeLossRow;
    if (!lid || !field) return false;
    const row = errorsByCell.get(lid);
    return !!row && row.has(field);
  }, [errorsByCell]);

  const getCellErrorMessage = useCallback((params: any): string | null => {
    const lid = (params?.data as LocalRow)?._lid;
    const field = params?.colDef?.field as keyof TimeLossRow;
    if (!lid || !field) return null;
    const row = errorsByCell.get(lid);
    return row?.get(field) ?? null;
  }, [errorsByCell]);
  const [confirmState, setConfirmState] = useState<{ open: boolean; message: string; onOk: () => void; danger?: boolean }>({ open: false, message: '', onOk: () => {}, danger: false });

  const reload = useCallback(async () => {
    setLoading(true);
    onLoadingChange?.(true);
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
          // категориальные ID как строки, чтобы не участвовать в числовой агрегации
          DirectnessID: (x as any).DirectnessID != null ? String((x as any).DirectnessID) as any : (x as any).DirectnessID,
          ReasonGroupID: (x as any).ReasonGroupID != null ? String((x as any).ReasonGroupID) as any : (x as any).ReasonGroupID,
          _lid: mkId(),
        }))
      );
      setError(null);
    } catch (e: any) {
      setError(e.message ?? 'Load error');
    } finally {
      setLoading(false);
      onLoadingChange?.(false);
    }
  }, [date, startDate, endDate]);

  useEffect(() => {
    // Загружаем только если компонент активен
    if (isActive) {
      reload();
    }
  }, [reload, isActive]);

  // Compute available height in FOCUS mode only (leave normal mode untouched)
  useLayoutEffect(() => {
    const compute = () => {
      const el = gridWrapperRef.current;
      if (!el) return;
      const isFocus = typeof document !== 'undefined' && document.body.classList.contains('app-focus');
      if (!isFocus) {
        // в обычном режиме используем стандартную высоту из CSS
        setGridHeightPx(null);
        return;
      }
      const top = el.getBoundingClientRect().top;
      const h = Math.max(200, Math.floor(window.innerHeight - top - 8));
      setGridHeightPx(h);
    };
    compute();
    window.addEventListener('resize', compute);
    // Recompute when body class changes (focus mode toggles)
    const obs = new MutationObserver(compute);
    if (typeof document !== 'undefined') {
      obs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }
    return () => { window.removeEventListener('resize', compute); obs.disconnect(); };
  }, []);

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
    // Живая очистка ошибки после изменения значения
    if (validationOn) {
      const lid = ev.data._lid;
      // Простая проверка только изменённого поля
      const v = (ev.data as any)[colId];
      const isEmpty = v === null || v === undefined || v === '';
      if (isEmpty) setCellError(lid, colId, String(t('required') || 'Обязательное поле'));
      else if (colId === 'ManHours') {
        const n = Number(v);
        if (!isFinite(n) || n <= 0) setCellError(lid, 'ManHours', String(t('mustBePositiveNumber') || 'Должно быть числом > 0'));
        else clearCellError(lid, 'ManHours');
      } else if (colId === 'CommentText') {
        const s = String(v ?? '').trim();
        if (!s) setCellError(lid, 'CommentText', String(t('required') || 'Обязательное поле'));
        else clearCellError(lid, 'CommentText');
      } else {
        clearCellError(lid, colId);
      }
    }
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
    const toUpdate = editMode ? rows.filter(r => !r._isNew && !r._isDeleted && r._dirty && r._dirty.size > 0) : [];
    const toDelete = rows.filter(r => !r._isNew && r._isDeleted);

    const required: (keyof TimeLossRow)[] = ['OnlyDate','WorkShopID','WorkCenterID','DirectnessID','ReasonGroupID','ManHours','CommentText'];
    // Полная валидация перед сохранением
    const newErrors = new Map<string, Map<keyof TimeLossRow, string>>();
    const checkRow = (r: LocalRow) => {
      const rowErrors = new Map<keyof TimeLossRow, string>();
      for (const f of required) {
        const v = (r as any)[f];
        const isEmpty = v === null || v === undefined || v === '';
        if (isEmpty) rowErrors.set(f, String(t('required') || 'Обязательное поле'));
      }
      const mh = Number(r.ManHours);
      if (!isFinite(mh) || mh <= 0) rowErrors.set('ManHours', String(t('mustBePositiveNumber') || 'Должно быть числом > 0'));
      const ct = String((r as any).CommentText ?? '').trim();
      if (!ct) rowErrors.set('CommentText', String(t('required') || 'Обязательное поле'));
      return rowErrors;
    };
    for (const r of [...toCreate, ...toUpdate]) {
      const rowErr = checkRow(r);
      if (rowErr.size) newErrors.set(r._lid, rowErr);
    }
    if (newErrors.size) {
      setErrorsByCell(newErrors);
      setValidationOn(true);
      // Не используем глобальный error, чтобы не скрывать таблицу
      // Сфокусировать первую ошибку
      try {
        const api: any = gridApiRef.current;
        const [lid, errMap] = Array.from(newErrors.entries())[0];
        const firstField = Array.from(errMap.keys())[0];
        const rowIndex = rows.findIndex(r => r._lid === lid);
        if (rowIndex >= 0) {
          api.ensureIndexVisible?.(rowIndex);
          api.setFocusedCell?.(rowIndex, String(firstField));
        }
        api?.refreshCells?.({ force: true, suppressFlash: true });
      } catch {}
      return;
    }

    try {
      for (const r of toDelete) await apiSoftDelete(r.EntryID);

      const created: LocalRow[] = [];
      const toPayload = (r: LocalRow): Partial<TimeLossRow> => ({
          OnlyDate: r.OnlyDate,
          WorkShopID: r.WorkShopID,
          WorkCenterID: r.WorkCenterID,
        DirectnessID: r.DirectnessID == null ? null as any : Number(r.DirectnessID) as any,
        ReasonGroupID: r.ReasonGroupID == null ? null : Number(r.ReasonGroupID) as any,
          ManHours: r.ManHours,
          CommentText: r.CommentText,
          ActionPlan: r.ActionPlan,
          Responsible: r.Responsible,
          CompletedDate: r.CompletedDate,
      });

      for (const r of toCreate) {
        const db = await apiAddRow(toPayload(r));
        const dbRow = db as TimeLossRow;
        // нормализуем дату, чтобы сразу отрисовалась в первом столбце
        const onlyDateNorm = normalizeDate((dbRow as any).OnlyDate) ?? r.OnlyDate;
        created.push({ ...(dbRow as TimeLossRow), OnlyDate: onlyDateNorm!, _lid: r._lid });
      }

      for (const r of toUpdate) {
        for (const f of r._dirty!) {
          const v = (r as any)[f];
          const send = (f === 'DirectnessID' || f === 'ReasonGroupID') && v != null ? Number(v) : v;
          await apiPatchCell(r.EntryID, f, send, (r as any).RowVer);
        }
      }

      setRows(prev => prev
        .filter(r => !(r._isNew && r._isDeleted))
        .map(r => {
          if (r._isDeleted && !r._isNew) return null as any;
          const createdMatch = created.find(c => c._lid === r._lid);
          if (createdMatch) {
            const onlyDateNorm = normalizeDate((createdMatch as any).OnlyDate) ?? r.OnlyDate;
            return { ...createdMatch, OnlyDate: onlyDateNorm!, _dirty: new Set(), _isNew: false } as LocalRow;
          }
          if (r._dirty && r._dirty.size > 0) return { ...r, _dirty: new Set() } as LocalRow;
          return r;
        })
        .filter(Boolean) as LocalRow[]);

      setError(null);
    } catch (e: any) {
      setError(e.message ?? 'Save failed');
    }
  }, [rows, editMode]);

  const actions = (
    <div className="flex items-center gap-2">
      <button onClick={addRow} title={String(t('timeLossTable.addRow'))} aria-label={String(t('timeLossTable.addRow'))} className="h-8 w-8 p-2 rounded-md border border-gray-300 bg-white text-slate-700 hover:bg-gray-100 flex items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><path d="M12 5a1 1 0 0 1 1 1v5h5a1 1 0 1 1 0 2h-5v5a1 1 0 1 1-2 0v-5H6a1 1 0 1 1 0-2h5V6a1 1 0 0 1 1-1Z"/></svg>
      </button>
      <button onClick={() => { const msg = String(t('timeLossTable.confirmRefresh') || 'Refresh?'); setConfirmState({ open: true, message: msg, onOk: () => reload(), danger: false }); }} title={String(t('timeLossTable.refresh'))} aria-label={String(t('timeLossTable.refresh'))} className="h-8 w-8 p-2 rounded-md border border-gray-300 bg-white text-slate-700 hover:bg-gray-100 flex items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><path d="M17.65 6.35A7.95 7.95 0 0 0 12 4V1L7 6l5 5V7a5 5 0 1 1-4.9 6.09 1 1 0 0 0-1.96.24A7 7 0 1 0 17.65 6.35Z"/></svg>
      </button>
      <AgGridExportButton api={gridApi} fileName="time_loss" variant="icon" />
      <FocusModeToggle variant="dark" />
      <EditModeToggle on={editMode} onToggle={() => setEditMode(v => !v)} title={editMode ? String(t('timeLossTable.editOn')) : String(t('timeLossTable.edit'))} />
      <button onClick={() => { const willDelete = rows.some(r => !r._isNew && r._isDeleted); let msg = String(t('timeLossTable.confirmSave') || 'Confirm save'); if (willDelete) msg += "\n" + String(t('timeLossTable.confirmSaveWillDelete') || 'Some rows will be deleted.'); setConfirmState({ open: true, message: msg, onOk: () => saveAll(), danger: willDelete }); }} title={String(t('timeLossTable.save'))} aria-label={String(t('timeLossTable.save'))} className="h-8 w-8 p-2 rounded-md border bg-emerald-600 text-white hover:bg-emerald-700 flex items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><path d="M17 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7l-4-4Zm-5 16a3 3 0 1 1 0-6 3 3 0 0 1 0 6Zm3-10H5V5h10v4Z"/></svg>
      </button>
      <button onClick={() => setDeleteMode(v => !v)} title={deleteMode ? (t('timeLossTable.delete') as string) + ' ON' : (t('timeLossTable.delete') as string)} aria-label="Toggle delete mode" className={`h-8 w-8 p-2 rounded-md border flex items-center justify-center ${deleteMode ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-white text-red-600 hover:bg-red-50'}`}>
        <Trash2 className="w-4 h-4" />
      </button>
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

  // Более надёжный список Reason по фактическим данным (исключает несовпадения ID/типов)
  const reasonValuesFromRows = useMemo(() => {
    // Собираем по строкам, но возвращаем уникальные метки, чтобы в фильтре не дублировать одинаковые переводы
    const labelSet = new Set<string>();
    const allMaps: DictItem[] = ([] as DictItem[]).concat(...Object.values(reasonByWs || {} as Record<string, DictItem[]>));
    const idToLabel = new Map<string, string>();
    allMaps.forEach(i => { idToLabel.set(String(i.value), getDictLabel(i, lang)); });
    rows.forEach(r => {
      const id = r.ReasonGroupID != null ? String(r.ReasonGroupID) : '';
      if (!id) return;
      const label = idToLabel.get(id) || id;
      labelSet.add(label);
    });
    return Array.from(labelSet);
  }, [rows, reasonByWs, lang]);

  // Глобальная карта РЦ (ID -> отображаемое имя), чтобы SetFilter мог показывать метки без привязки к строке
  const wcValueToLabel = useMemo(() => {
    const m = new Map<string, string>();
    const map = wcByWs || {} as Record<string, DictItem[]>;
    Object.values(map).forEach(arr => (arr || []).forEach(i => {
      const k = String(i.value);
      if (!m.has(k)) {
        const lbl =
          getDictLabel(i, lang) ||
          i.labelEn ||
          i.labelZh ||
          i.label ||
          k;
        m.set(k, String(lbl));
      }
    }));
    return m;
  }, [wcByWs, lang]);

  // Lists for Set Filters on non-reference columns
  const onlyDateValues = useMemo(() => {
    const s = new Set<string>();
    rows.forEach(r => {
      const iso = normalizeDate(r.OnlyDate);
      if (!iso) return;
      s.add(iso);
    });
    const arr = Array.from(s);
    // Сортировка по ISO-строке, затем возвращаем без дубликатов
    arr.sort();
    return arr;
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
    rows.forEach(r => {
      const iso = normalizeDate(r.CompletedDate);
      if (!iso) return;
      s.add(iso);
    });
    const arr = Array.from(s);
    arr.sort();
    return arr;
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

  // ---------- Каскадный сбор значений SetFilter (игнорируя собственный столбец) ----------
  const getFilterKey = useCallback((r: LocalRow, colId: string): string => {
    switch (colId) {
      case 'OnlyDate':
        return String(normalizeDate(r.OnlyDate) ?? '');
      case 'CompletedDate':
        return String(normalizeDate(r.CompletedDate) ?? '');
      case 'WorkShopID':
        return String(r.WorkShopID ?? '');
      case 'WorkCenterID':
        // Ключом для фильтра делаем ID; отображаемая метка настраивается через valueFormatter
        return String(r.WorkCenterID ?? '');
      case 'DirectnessID':
        return r.DirectnessID == null ? '' : String(r.DirectnessID);
      case 'ReasonGroupID': {
        const all: DictItem[] = ([] as DictItem[]).concat(...Object.values(reasonByWs || {} as Record<string, DictItem[]>));
        const lbl = getDictLabel(findByValue(all, r.ReasonGroupID), lang);
        return String(lbl || '');
      }
      case 'CommentText':
        return String(r.CommentText ?? '').trim();
      case 'ActionPlan':
        return String(r.ActionPlan ?? '').trim();
      case 'Responsible':
        return String(r.Responsible ?? '').trim();
      case 'ManHours': {
        const v = r.ManHours as any;
        const n = parseNumberFromText(v);
        if (n === null) return '';
        return new Intl.NumberFormat(undefined, { maximumFractionDigits: 6 }).format(n);
      }
      default:
        return String((r as any)[colId] ?? '');
    }
  }, [reasonByWs, lang, findByValue]);

  const collectFilterValuesIgnoringSelf = useCallback((params: any, colId: string, sort?: (a: string, b: string) => number) => {
    const model = { ...(params.api.getFilterModel?.() ?? {}) } as Record<string, any>;
    delete model[colId];

    const passes = (row: LocalRow) => {
      for (const [k, m] of Object.entries(model)) {
        if ((m as any)?.filterType !== 'set') continue;
        const allowed: string[] = Array.isArray((m as any).values) ? (m as any).values : [];
        const key = getFilterKey(row, k);
        if (allowed.length && !allowed.includes(key)) return false;
      }
      return true;
    };

    const set = new Set<string>();
    (filteredRows || rows).forEach((r) => {
      if (!passes(r as LocalRow)) return;
      const v = getFilterKey(r as LocalRow, colId);
      if (v) set.add(v);
    });
    const out = Array.from(set);
    if (sort) out.sort(sort); else out.sort();
    params.success(out);
  }, [getFilterKey, filteredRows, rows]);

  const columns = useMemo<ColDef<LocalRow>[]>(() => [
    { field: 'OnlyDate', headerName: t('timeLossTable.date') as string, editable: (p: any) => (editMode || !!(p?.data as any)?._isNew), cellEditor: 'agDateStringCellEditor', width: 160,
      // держим чекбоксы всегда включёнными; показываем/скрываем через CSS
      checkboxSelection: true as any,
      headerCheckboxSelection: true as any,
      filter: 'agSetColumnFilter',
      filterValueGetter: (p: any) => String(normalizeDate(p?.data?.OnlyDate) ?? ''),
      filterParams: {
        treeList: true as any,
        includeBlanksInFilter: true,
        refreshValuesOnOpen: true,
        treeListPathGetter: (value: any) => {
          const s = String(value ?? '').trim();
          const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
          return m ? [m[1], m[2], m[3]] : null;
        },
        values: (params: any) => collectFilterValuesIgnoringSelf(params, 'OnlyDate'),
      },
      valueFormatter: (p: any) => {
        const iso = String(normalizeDate(p.value) ?? '');
        const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        return m ? `${m[3]}.${m[2]}.${m[1]}` : (p.value ?? '');
      },
    },
    { field: 'WorkShopID', headerName: t('timeLossTable.workshop') as string, editable: (p: any) => (editMode || !!(p?.data as any)?._isNew), filter: 'agSetColumnFilter', width: 160, cellDataType: 'text',
      filterParams: {
        refreshValuesOnOpen: true,
        values: (params: any) => collectFilterValuesIgnoringSelf(params, 'WorkShopID', (a, b) => a.localeCompare(b)),
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
    { field: 'WorkCenterID', headerName: t('timeLossTable.workCenter') as string, editable: (p: any) => (editMode || !!(p?.data as any)?._isNew), filter: 'agSetColumnFilter', width: 200, cellDataType: 'text',
      filterParams: {
        includeBlanksInFilter: true,
        refreshValuesOnOpen: true,
        // ключ — это ID (String). valueFormatter показывает метку.
        values: (params: any) => collectFilterValuesIgnoringSelf(params, 'WorkCenterID', (a, b) => a.localeCompare(b, undefined, { numeric: true } as any)),
        keyCreator: (p: any) => String(p.value ?? ''),
        valueFormatter: (p: any) => wcValueToLabel.get(String(p.value)) || String(p.value ?? ''),
      },
      cellEditor: 'agRichSelectCellEditor',
      cellEditorParams: (p: any) => ({
        values: (wcByWs[p?.data?.WorkShopID] ?? []).map(w => String(w.value)),
        formatValue: (id: any) => { const ws = p?.data?.WorkShopID; const opts = wcByWs[ws] ?? []; return getDictLabel(opts.find(o => String(o.value) === String(id)), lang); },
        searchDebounceDelay: 0,
      }),
      valueFormatter: params => { const ws = (params.data as LocalRow)?.WorkShopID; const opts = wcByWs[ws] ?? []; return getDictLabel(opts.find(o => String(o.value) === String(params.value)), lang); },
    },
    { field: 'DirectnessID', headerName: t('timeLossTable.lossType') as string, editable: (p: any) => (editMode || !!(p?.data as any)?._isNew), filter: 'agSetColumnFilter', width: 160, cellDataType: 'text',
      filterParams: {
        refreshValuesOnOpen: true,
        values: (params: any) => collectFilterValuesIgnoringSelf(params, 'DirectnessID', (a, b) => a.localeCompare(b)),
        valueFormatter: (p: any) => getDictLabel(findByValue(dicts?.directness as any, p.value), lang),
        includeBlanksInFilter: true,
      },
      cellEditor: 'agRichSelectCellEditor', cellEditorParams: { values: directnessValues, formatValue: (id: any) => getDictLabel((dicts?.directness ?? []).find(o => String(o.value) === String(id)), lang) },
      // Храним ID как строку, парсер приводит к строке
      valueParser: p => (p.newValue == null || p.newValue === '') ? null : String(p.newValue),
      valueFormatter: params => getDictLabel((dicts?.directness ?? []).find(o => Number(o.value) === Number(params.value)), lang),
    },
    { field: 'ReasonGroupID', headerName: t('timeLossTable.lossReason') as string, editable: (p: any) => (editMode || !!(p?.data as any)?._isNew), filter: 'agSetColumnFilter', width: 200, cellDataType: 'text',
      filterParams: {
        refreshValuesOnOpen: true,
        values: (params: any) => collectFilterValuesIgnoringSelf(params, 'ReasonGroupID', (a, b) => a.localeCompare(b)),
        // Группируем одинаковые переводы даже при разных ID
        keyCreator: (p: any) => {
          const all: DictItem[] = ([] as DictItem[]).concat(...Object.values(reasonByWs || {} as Record<string, DictItem[]>));
          const label = getDictLabel(findByValue(all, p.value), lang);
          return label || String(p.value ?? '');
        },
        valueFormatter: (p: any) => {
          // Если уже пришла метка (из values мы отдаём массив меток) — показываем её
          if (typeof p.value === 'string' && p.value.trim() !== '') return p.value;
          // иначе формат по любому справочнику
          const all: DictItem[] = ([] as DictItem[]).concat(...Object.values(reasonByWs || {} as Record<string, DictItem[]>));
          const lbl = getDictLabel(findByValue(all, p.value), lang);
          return lbl || String(p.value ?? '');
        },
        includeBlanksInFilter: true,
      },
      cellEditor: 'agRichSelectCellEditor',
      cellEditorParams: (p: any) => ({
        values: (reasonByWs[p?.data?.WorkShopID] ?? []).map(r => String(r.value)),
        formatValue: (id: any) => { const ws = p?.data?.WorkShopID; const opts = reasonByWs[ws] ?? []; return getDictLabel(opts.find(o => String(o.value) === String(id)), lang); },
        searchDebounceDelay: 0,
      }),
      valueParser: p => (p.newValue == null || p.newValue === '') ? null : String(p.newValue),
      valueFormatter: params => { const ws = (params.data as LocalRow)?.WorkShopID; const opts = reasonByWs[ws] ?? []; return getDictLabel(opts.find(o => Number(o.value) === Number(params.value)), lang); },
    },
    { field: 'CommentText', headerName: t('timeLossTable.comment') as string, editable: (p: any) => (editMode || !!(p?.data as any)?._isNew), filter: 'agSetColumnFilter', wrapText: true, autoHeight: true, width: 460, cellDataType: 'text',
      filterParams: {
        refreshValuesOnOpen: true,
        values: (params: any) => collectFilterValuesIgnoringSelf(params, 'CommentText', (a, b) => a.localeCompare(b)),
        includeBlanksInFilter: true,
        // показываем в списке одной строкой, без переносов, но поиск идёт по полному тексту
        valueFormatter: (p: any) => {
          const raw = String(p.value ?? '');
          const oneLine = raw.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
          return oneLine.length > 25 ? oneLine.slice(0, 24) + '…' : oneLine;
        },
        textFormatter: (val: any) => String(val ?? '').replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').toLowerCase(),
      },
      valueFormatter: p => { const v = p.value; if (v == null || v === '') return ''; const s = String(v).trim(); return s.toLowerCase() === 'nan' ? '' : s; },
      cellEditor: 'agLargeTextCellEditor', cellEditorPopup: true, cellEditorPopupPosition: 'over', cellEditorParams: { maxLength: 1000, rows: 6, cols: 40 },
    },
    { field: 'ManHours', headerName: t('timeLossTable.manHours') as string, editable: (p: any) => (editMode || !!(p?.data as any)?._isNew), filter: 'agSetColumnFilter', width: 120,
      filterParams: {
        includeBlanksInFilter: true,
        refreshValuesOnOpen: true,
        values: (params: any) => collectFilterValuesIgnoringSelf(params, 'ManHours', (a, b) => a.localeCompare(b, undefined, { numeric: true } as any)),
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
      valueParser: p => parseNumberFromText(p.newValue),
      clipboardValueGetter: (p: any) => {
        const n = Number(p?.data?.ManHours);
        return Number.isFinite(n) ? n : null;
      },
      valueFormatter: params => {
        const v = params.value;
        if (v === null || v === undefined || v === '') return '';
        if (typeof v === 'string' && v.trim().toLowerCase() === 'nan') return '';
        const n = Number(v);
        if (!isFinite(n)) return '';
        return new Intl.NumberFormat(undefined, { maximumFractionDigits: 6 }).format(n);
      },
    },
    { field: 'ActionPlan', headerName: t('timeLossTable.actionPlan') as string, editable: (p: any) => (editMode || !!(p?.data as any)?._isNew), filter: 'agSetColumnFilter', wrapText: true, autoHeight: true, width: 360, cellDataType: 'text',
      filterParams: { includeBlanksInFilter: true, refreshValuesOnOpen: true, values: (params: any) => collectFilterValuesIgnoringSelf(params, 'ActionPlan', (a, b) => a.localeCompare(b)) },
      valueFormatter: p => { const v = p.value; if (v == null || v === '') return ''; const s = String(v).trim(); return s.toLowerCase() === 'nan' ? '' : s; },
      cellEditor: 'agLargeTextCellEditor', cellEditorPopup: true, cellEditorPopupPosition: 'over', cellEditorParams: { maxLength: 1000, rows: 6, cols: 40 },
    },
    { field: 'Responsible', headerName: t('timeLossTable.responsible') as string, editable: (p: any) => (editMode || !!(p?.data as any)?._isNew), filter: 'agSetColumnFilter', width: 160, cellDataType: 'text',
      filterParams: { includeBlanksInFilter: true, refreshValuesOnOpen: true, values: (params: any) => collectFilterValuesIgnoringSelf(params, 'Responsible', (a, b) => a.localeCompare(b)) },
      valueFormatter: p => { const v = p.value; if (v == null || v === '') return ''; const s = String(v).trim(); return s.toLowerCase() === 'nan' ? '' : s; },
    },
    { field: 'CompletedDate', headerName: t('timeLossTable.completedDate') as string, editable: (p: any) => (editMode || !!(p?.data as any)?._isNew), cellEditor: 'agDateStringCellEditor', width: 160,
      filter: 'agSetColumnFilter',
      filterValueGetter: (p: any) => String(normalizeDate(p?.data?.CompletedDate) ?? ''),
      filterParams: {
        treeList: true as any,
        includeBlanksInFilter: true,
        refreshValuesOnOpen: true,
        treeListPathGetter: (value: any) => {
          const s = String(value ?? '').trim();
          const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
          return m ? [m[1], m[2], m[3]] : null;
        },
        values: (params: any) => collectFilterValuesIgnoringSelf(params, 'CompletedDate'),
      },
      valueFormatter: p => { const v = p.value; if (v == null || v === '') return ''; const iso = String(normalizeDate(v) ?? ''); const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? `${m[3]}.${m[2]}.${m[1]}` : ''; },
    },
  ], [t, lang, dicts, wcByWs, reasonByWs, directnessValues, toggleDelete, deleteMode, editMode]);

  const defaultColDef = useMemo<ColDef>(() => ({
    resizable: true,
    sortable: true,
    filter: true,
    editable: true,
    cellClassRules: {
      'copied-cell': params => copiedCellsRef.current.has(`${(params.data as LocalRow)?._lid}|${params.colDef.field}`),
      'tl-cell-error': params => validationOn && hasCellError(params),
    },
    tooltipValueGetter: (p: any) => getCellErrorMessage(p) || undefined,
  }), [validationOn, hasCellError, getCellErrorMessage]);

  // Корректная обработка вставки из буфера для select-колонок: принимать метки и конвертировать в ID
  const processCellFromClipboard = useCallback((p: any) => {
    const colId = p?.column?.getColDef?.()?.field as keyof TimeLossRow | undefined;
    const raw = p?.value;
    if (!colId) return raw;
    // Уважаем editable: в обычном режиме блокируем вставку в не-редактируемые ячейки
    try {
      const rowIsNew = !!p?.node?.data?._isNew;
      if (!editMode && !rowIsNew) return p.value;
    } catch {}
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
      let id = matchItem(items, text);
      // если не нашли по текущему WS — попробуем найти глобально среди всех WC
      if (id == null) {
        const all: DictItem[] = ([] as DictItem[]).concat(...Object.values(wcByWs || {} as Record<string, DictItem[]>));
        id = matchItem(all, text);
      }
      return id != null ? String(id) : null;
    }
    if (colId === 'DirectnessID') {
      const id = matchItem(dicts?.directness as any, text);
      return id != null ? String(id) : null;
    }
    if (colId === 'ReasonGroupID') {
      const ws = p?.node?.data?.WorkShopID ? String(p.node.data.WorkShopID) : undefined;
      const items = ws ? reasonByWs[ws] : undefined;
      let id = matchItem(items as any, text);
      if (id == null) {
        const all: DictItem[] = ([] as DictItem[]).concat(...Object.values(reasonByWs || {} as Record<string, DictItem[]>));
        id = matchItem(all as any, text);
      }
      return id != null ? String(id) : null;
    }
    if (colId === 'ManHours') {
      return parseNumberFromText(text);
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

  const handleSelectionChanged = useCallback((params: any) => {
    if (!deleteMode) return;
    try {
      const selected: any[] = params.api.getSelectedNodes?.() || [];
      const selectedIds = new Set<string>(selected.map((n: any) => n?.data?._lid).filter(Boolean));
      setRows(prev => prev.map(r => ({ ...(r as any), _isDeleted: selectedIds.has((r as any)._lid) })) as any);
    } catch {}
  }, [deleteMode]);

  // При входе в режим удаления очищаем любые выделения и сбрасываем чекбоксы
  useEffect(() => {
    if (!deleteMode) return;
    try {
      const api: any = gridApiRef.current;
      api?.deselectAll?.();
      api?.clearRangeSelection?.();
    } catch {}
    setRows(prev => prev.map(r => (r._isDeleted ? ({ ...(r as any), _isDeleted: false } as any) : r)) as any);
  }, [deleteMode]);

  // Первичная загрузка — не показываем локальный спиннер, но оставляем «коробку» нужной высоты
  if (loading && suppressLocalLoaders) {
    return (
      <div
        ref={gridWrapperRef}
        className="ag-theme-quartz"
        style={{ width: '100%', height: gridHeightPx != null ? `${gridHeightPx}px` : '78vh' }}
      />
    );
  }
  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <LoadingSpinner size="xl" />
      </div>
    );
  }

  if (error) return <div className="flex justify-center items-center h-64 text-red-600">{error}</div>;

  const totalManHours = filteredRows.reduce((s, r) => s + (Number(r.ManHours) || 0), 0);

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
      <div ref={gridWrapperRef} data-grid="time-loss-table" className={`ag-theme-quartz ${deleteMode ? 'tl-delete-on' : ''}`} style={{ width: '100%', height: gridHeightPx != null ? `${gridHeightPx}px` : '78vh' }}>
        <AgGridReact<LocalRow>
          onGridReady={(p) => { gridApiRef.current = p.api; setGridApi(p.api); }}
          rowData={filteredRows}
          columnDefs={columns}
          defaultColDef={defaultColDef}
          popupParent={typeof document !== 'undefined' ? (document.body as any) : undefined}
          rowSelection={'multiple'}
          suppressRowClickSelection={deleteMode}
          onSelectionChanged={handleSelectionChanged}
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
            // Блокируем удаление в не-редактируемых ячейках в обычном режиме
            const k = String(ke.key);
            if (k === 'Delete' || k === 'Backspace') {
              const rowData = e?.data as LocalRow | undefined;
              const isEditableTarget = editMode || !!rowData?._isNew;
              if (!isEditableTarget) {
                ke.preventDefault?.();
                ke.stopPropagation?.();
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
          statusBar={{ statusPanels: [{ statusPanel: ManHoursStatusPanel, align: 'left' }] }}
          rowClassRules={{ 'line-through opacity-50': (p: any) => !!(p.data as LocalRow)?._isDeleted }}
          context={{ gridName: 'time-loss-table' }}
        />
      </div>
      <div className="px-2 py-1 text-sm text-slate-600">{(t('total') as string) || '合计'}: <span className="font-semibold">{totalManHours.toFixed(1)}</span></div>
      {validationOn && errorsByCell.size > 0 && (
        <div className="px-2 py-1 text-sm text-red-600">Заполните обязательные поля</div>
      )}
    </div>
  );
};

export default TimeLossTable;
