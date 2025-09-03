import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import { createPortal } from 'react-dom';
import { ColumnDef, getCoreRowModel, useReactTable, flexRender } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';
import {
  apiGetRows,
  apiGetDicts,
  apiPatchCell,
  apiAddRow,
  apiCopyRow,
  apiSoftDelete
} from '../../../../config/timeloss-api';

/** ==== Типы данных ==== */
type DictItem = {
  value: string | number;
  label: string;        // default label
  labelEn?: string;     // English label (optional)
  labelZh?: string;     // Chinese label (optional)
};
type Dicts = {
  workshops: DictItem[];                                      // WorkShopID
  workcentersByWS: Record<string, DictItem[]>;                // WorkCenterID[]
  directness: DictItem[];                                     // DirectnessID
  reasonGroupsByWS: Record<string, DictItem[]>;               // ReasonGroupID[]
};

export type TimeLossRow = {
  EntryID: number;
  OnlyDate: string;          // 'YYYY-MM-DD'
  WorkShopID: string;
  WorkCenterID: string;
  DirectnessID: number;
  ReasonGroupID: number;
  CommentText: string | null;
  ManHours: number | null;
  ActionPlan: string | null;
  Responsible: string | null;
  CompletedDate: string | null; // 'YYYY-MM-DD' | null
};

type LocalRow = TimeLossRow & {
  _lid: string;
  _isNew?: boolean;
  _isDeleted?: boolean;
  _dirty?: Set<keyof TimeLossRow>;
};

type Props = {
  date: string;                         // фильтр по дате
  initialWorkShop?: string;             // дефолтный цех для добавления строк
};

/** ==== Редакторы ячеек ==== */
// Приведение приходящих дат к формату YYYY-MM-DD
function normalizeDate(value: any): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string') {
    // Уже ISO без времени
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    // Если есть время — берём только дату
    const isoMatch = value.match(/^\d{4}-\d{2}-\d{2}/);
    if (isoMatch) return isoMatch[0];
    // Пробуем распарсить строку в дату
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return value; // как есть, если не распарсилось
  }
  // Объект Date или число timestamp
  const d = new Date(value);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return String(value);
}
const getDictLabel = (o: DictItem, lang: string) => {
  if (lang?.startsWith('en')) return o.labelEn ?? o.label;
  if (lang?.startsWith('zh')) return o.labelZh ?? o.label;
  return o.labelEn ?? o.labelZh ?? o.label;
};

// Возвращаем текст, который реально видит пользователь в ячейке (с учётом языка)
const displayText = (
  field: keyof TimeLossRow,
  row: LocalRow,
  dicts: Dicts | null,
  lang: string
) => {
  const toLabel = (o?: DictItem) => (o ? getDictLabel(o, lang) : '');
  switch (field) {
    case 'WorkShopID': {
      const o = dicts?.workshops?.find(x => String(x.value) === String(row.WorkShopID));
      return toLabel(o) || String(row.WorkShopID ?? '');
    }
    case 'WorkCenterID': {
      const opts = dicts?.workcentersByWS?.[row.WorkShopID] ?? [];
      const o = opts.find(x => String(x.value) === String(row.WorkCenterID));
      return toLabel(o) || String(row.WorkCenterID ?? '');
    }
    case 'DirectnessID': {
      const o = dicts?.directness?.find(x => Number(x.value) === Number(row.DirectnessID));
      return toLabel(o) || String(row.DirectnessID ?? '');
    }
    case 'ReasonGroupID': {
      const opts = dicts?.reasonGroupsByWS?.[row.WorkShopID] ?? [];
      const o = opts.find(x => Number(x.value) === Number(row.ReasonGroupID));
      return toLabel(o) || String(row.ReasonGroupID ?? '');
    }
    default:
      return String((row as any)[field] ?? '');
  }
};

// helpers для безопасной нормализации
const safeArr = (x: any) => (Array.isArray(x) ? x : []);
const str = (x: any) => (x === null || x === undefined ? '' : String(x));

// строим workshops + workcentersByWS из Ref.WorkShop_CustomWS
function buildWSWCDicts(raw: any): { workshops: DictItem[]; workcentersByWS: Record<string, DictItem[]> } {
  let list: any[] = [];
  if (Array.isArray(raw?.Ref?.WorkShop_CustomWS)) list = raw.Ref.WorkShop_CustomWS;
  else if (Array.isArray(raw?.WorkShop_CustomWS)) list = raw.WorkShop_CustomWS;
  else if (Array.isArray((raw as any)?.['Ref.WorkShop_CustomWS'])) list = (raw as any)['Ref.WorkShop_CustomWS'];
  else if (Array.isArray(raw?.ref?.WorkShop_CustomWS)) list = raw.ref.WorkShop_CustomWS;

  const wsMap = new Map<string, DictItem>();
  const wcByWs: Record<string, DictItem[]> = {};

  for (const rec of list) {
    const wsId = str(rec?.WorkShop_CustomWS);
    const wcId = str(rec?.WorkCenter_CustomWS);

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

  return {
    workshops: Array.from(wsMap.values()),
    workcentersByWS: wcByWs,
  };
}

// Строим workshops и workcentersByWS из Ref.WorkShop_CustomWS
function normalizeDicts(raw: any): Dicts {
  const out: Dicts = {
    workshops: [],
    workcentersByWS: {},
    directness: raw?.directness ?? [],
    reasonGroupsByWS: raw?.reasonGroupsByWS ?? {},
  };

  const list =
    raw?.Ref?.WorkShop_CustomWS ??
    raw?.WorkShop_CustomWS ??
    raw?.RefWorkShop_CustomWS ??
    [];

  const wsMap = new Map<string, DictItem>();
  const wcByWs: Record<string, DictItem[]> = {};

  for (const rec of list) {
    const wsId = String(rec.WorkShop_CustomWS ?? rec.WorkShopID ?? rec.WorkShop);
    const wcId = String(rec.WorkCenter_CustomWS ?? rec.WorkCenterID ?? rec.WorkCenter);

    if (!wsId || !wcId) continue;

    if (!wsMap.has(wsId)) {
      wsMap.set(wsId, {
        value: wsId,
        label: rec.WorkShopName_EN || rec.WorkShopName_ZH || wsId,
        labelEn: rec.WorkShopName_EN,
        labelZh: rec.WorkShopName_ZH,
      });
    }

    wcByWs[wsId] ??= [];
    if (!wcByWs[wsId].some(x => String(x.value) === wcId)) {
      wcByWs[wsId].push({
        value: wcId,
        label: rec.WorkCenterName_EN || rec.WorkCenterName_ZH || wcId,
        labelEn: rec.WorkCenterName_EN,
        labelZh: rec.WorkCenterName_ZH,
      });
    }
  }

  out.workshops = Array.from(wsMap.values());
  out.workcentersByWS = wcByWs;
  return out;
}

function SelectCell({
  value, onChange, options, disabled, lang
}: { value: string | number | null; onChange: (v: any)=>void; options: DictItem[]; disabled?: boolean; lang: string }) {
  return (
    <select
      className="w-full h-8 bg-transparent border-0 rounded-none px-2 py-1 focus:outline-none focus:ring-0 select-text"
      value={value ?? ''}
      disabled={!!disabled}
      onChange={(e)=>onChange(e.target.value === '' ? null : e.target.value)}
    >
      <option value="" />
      {options.map(o => (
        <option key={String(o.value)} value={String(o.value)}>
          {getDictLabel(o, lang)}
        </option>
      ))}
    </select>
  );
}

function NumberCell({ value, onChange }:{ value:number|null; onChange:(v:number|null)=>void }) {
  return (
    <input
      type="text" inputMode="decimal" pattern="[0-9]+([\.,][0-9]+)?" placeholder="0,0"
      className="w-full h-8 bg-transparent border-0 rounded-none px-2 py-1 text-right focus:outline-none focus:ring-0 select-text"
      value={value ?? ''}
      onChange={(e)=> {
        const raw = e.target.value.replace(/,/g,'.');
        if (raw === '') { onChange(null); return; }
        // допускаем только числа и одну точку
        if (!/^\d*(?:\.\d*)?$/.test(raw)) return;
        onChange(raw === '' ? null : Number(raw));
      }}
    />
  );
}

function TextCell({ value, onChange }:{ value:string|null; onChange:(v:string|null)=>void }) {
  return (
    <input
      type="text"
      className="w-full h-8 bg-transparent border-0 rounded-none px-2 py-1 focus:outline-none focus:ring-0 select-text"
      value={value ?? ''}
      onChange={(e)=> onChange(e.target.value)}
    />
  );
}

function DateCell({ value, onChange }:{ value:string|null; onChange:(v:string|null)=>void }) {
  return (
    <input
      type="text" placeholder="ДД.ММ.ГГГГ"
      className="w-full h-8 bg-transparent border-0 rounded-none px-2 py-1 [appearance:none] focus:outline-none focus:ring-0 select-text"
      value={value ?? ''}
      onChange={(e)=> onChange(e.target.value || null)}
    />
  );
}

// --- Excel selection helpers ---
const keyCell = (r:number, c:number) => `${r}-${c}`;
const makeRect = (r1:number,c1:number,r2:number,c2:number) => {
  const [rs,re] = r1<r2 ? [r1,r2] : [r2,r1];
  const [cs,ce] = c1<c2 ? [c1,c2] : [c2,c1];
  const s = new Set<string>();
  for (let r = rs; r <= re; r++) {
    for (let c = cs; c <= ce; c++) s.add(keyCell(r,c));
  }
  return s;
};

// Проверка: клик по интерактивному элементу
const isFormEl = (el: EventTarget | null) => {
  if (!(el instanceof HTMLElement)) return false;
  return !!el.closest('input,select,textarea,[contenteditable="true"]');
};

// true, если внутри input/textarea есть выделенный текст (а не просто каретка)
const hasTextSelectionInInput = (el: EventTarget | null) => {
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return false;
  return el.selectionStart !== null && el.selectionEnd !== null && el.selectionStart !== el.selectionEnd;
};

// true если клик был по "стрелочке" селекта (правая часть ~22px)
const isSelectArrowClick = (target: EventTarget | null, e: React.MouseEvent) => {
  const el = target instanceof HTMLElement ? (target.closest('select') as HTMLSelectElement | null) : null;
  if (!el) return false;
  const r = el.getBoundingClientRect();
  const ARROW_W = 22; // ширина области стрелки
  return e.clientX >= r.right - ARROW_W;
};

// Поставить каретку по горизонтальной координате клика
function placeCaretFromClick(
  input: HTMLInputElement | HTMLTextAreaElement,
  clientX: number
) {
  const rect = input.getBoundingClientRect();
  const x = Math.max(0, Math.min(clientX - rect.left, rect.width));

  const cvs = document.createElement('canvas');
  const ctx = cvs.getContext('2d');
  const cs = getComputedStyle(input);
  if (!ctx) { const pos = (input.value ?? '').length; input.setSelectionRange(pos, pos); return; }
  ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;

  const text = input.value ?? '';
  let acc = 0, idx = 0;
  for (let i = 0; i < text.length; i++) {
    const w = ctx.measureText(text[i]).width;
    if (acc + w / 2 >= x) { idx = i; break; }
    acc += w; idx = i + 1;
  }
  input.setSelectionRange(idx, idx);
}

/** ==== Основной компонент таблицы ==== */
const TimeLossTable: React.FC<Props> = ({ date, initialWorkShop }) => {
  const { t, i18n } = useTranslation('production');
  const [rows, setRows] = useState<LocalRow[]>([]);
  const [dicts, setDicts] = useState<Dicts | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingCell, setSavingCell] = useState<string | null>(null); // key "id:field"
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState({create:0, update:0, del:0});

  // для подсветки выбранной ячейки + Ctrl+C/V (по локальному lid)
  const [focused, setFocused] = useState<{lid:string, col:keyof TimeLossRow} | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const mkId = () => Math.random().toString(36).slice(2);

  const markDirty = (lid:string, field:keyof TimeLossRow, value:any) => {
    setRows(prev => prev.map(r => {
      if (r._lid !== lid) return r;
      const dirty = new Set(r._dirty ?? []);
      dirty.add(field);
      return { ...r, [field]: value, _dirty: dirty } as LocalRow;
    }));
  };

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [rawDicts, r] = await Promise.all([apiGetDicts(), apiGetRows(date)]);
      const { workshops, workcentersByWS } = buildWSWCDicts(rawDicts);
      const dictsFinal: Dicts = {
        workshops: (workshops?.length ? workshops : (rawDicts.workshops ?? [])),
        workcentersByWS: (Object.keys(workcentersByWS || {}).length ? workcentersByWS : (rawDicts.workcentersByWS ?? {})),
        directness: rawDicts.directness ?? [],
        reasonGroupsByWS: rawDicts.reasonGroupsByWS ?? {},
      };
      setDicts(dictsFinal);
      setRows(r.map(x => ({
        ...x,
        OnlyDate: normalizeDate(x.OnlyDate) ?? '',
        CompletedDate: normalizeDate(x.CompletedDate),
        _lid: mkId()
      })));
      setError(null);
    } catch (e:any) {
      setError(e.message ?? 'Load error');
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(()=> { reload(); }, [reload]);

  /** helpers */
  const wcOptionsByWS = useMemo(()=> dicts?.workcentersByWS ?? {}, [dicts]);
  const rgOptionsByWS = useMemo(()=> dicts?.reasonGroupsByWS ?? {}, [dicts]);

  const handleChange = useCallback((row: LocalRow, field: keyof TimeLossRow, value:any) => {
    // каскад валидации: сменили WorkShop → сбросить ReasonGroup/WorkCenter если невалидны
    let patch: Partial<LocalRow> = { [field]: value };
    if (field === 'WorkShopID') {
      const ws = String(value || '');
      const validWCs = new Set((wcOptionsByWS[ws] ?? []).map(x => x.value));
      const validRGs = new Set((rgOptionsByWS[ws] ?? []).map(x => x.value));
      if (!validWCs.has(row.WorkCenterID)) patch.WorkCenterID = '' as any;
      if (!validRGs.has(row.ReasonGroupID)) patch.ReasonGroupID = null as any;
    }
    if (field === 'WorkCenterID' && (value === null || value === '')) {
      patch.WorkCenterID = '' as any;
    }
    if (field === 'ManHours' && value !== null && value < 0) value = 0;

    // локально
    setRows(prev => prev.map(r => r._lid === row._lid ? ({...r, ...patch}) as LocalRow : r));
    Object.entries(patch).forEach(([k,v]) => markDirty(row._lid, k as keyof TimeLossRow, v));
  }, [rgOptionsByWS, wcOptionsByWS]);

  const addRow = useCallback(() => {
    if (!dicts) return;
    const dir = Number(dicts.directness?.[0]?.value ?? 1);
    const todayIso = new Date().toISOString().slice(0, 10);

    const r: LocalRow = {
      _lid: mkId(),
      _isNew: true,
      _dirty: new Set<keyof TimeLossRow>([
        'OnlyDate','WorkShopID','WorkCenterID','DirectnessID','ReasonGroupID','ManHours'
      ]),

      EntryID: 0,
      OnlyDate: todayIso,

      // Пустые значения для 车间 / 条线 / 原因
      WorkShopID: '' as any,
      WorkCenterID: '' as any,
      ReasonGroupID: null as any,

      // Остальное без изменений
      DirectnessID: dir,
      CommentText: null,
      ManHours: null,
      ActionPlan: null,
      Responsible: null,
      CompletedDate: null
    };
    setRows(prev => [...prev, r]);
  }, [dicts]);

  const duplicateRow = useCallback((lid:string) => {
    setRows(prev => {
      const src = prev.find(x => x._lid === lid);
      if (!src) return prev;
      const copy: LocalRow = { ...src, _lid: mkId(), _isNew: true, _dirty: new Set<keyof TimeLossRow>(['OnlyDate','WorkShopID','WorkCenterID','DirectnessID','ReasonGroupID','ManHours']), EntryID: 0 };
      return [copy, ...prev];
    });
  }, []);

  const toggleDelete = useCallback((lid:string) => {
    setRows(prev => prev.map(r => r._lid === lid ? { ...r, _isDeleted: !r._isDeleted } : r));
  }, []);

  const saveAll = useCallback(async () => {
    setError(null);
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
        const payload = {
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
        for (const f of r._dirty!) {
          await apiPatchCell(r.EntryID, f, (r as any)[f]);
        }
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
        .filter(Boolean) as LocalRow[]
      );
    } catch (e:any) {
      setError(e.message ?? 'Save failed');
    }
  }, [rows]);

  /** ==== Определение колонок ==== */
  // Расширяем тип meta, чтобы был ключ field
  type ColDef = ColumnDef<LocalRow> & { meta?: { field?: keyof TimeLossRow } };

  const columns = useMemo<ColDef[]>(() => {
    const wsOpts = dicts?.workshops ?? [];
    const lang = i18n.language || 'zh';
    return [
      { accessorKey:'OnlyDate', header: t('timeLossTable.date'), meta:{field:'OnlyDate' as keyof TimeLossRow}, cell: ({row}) =>
          <DateCell value={row.original.OnlyDate} onChange={(v)=>handleChange(row.original,'OnlyDate', v)} /> },

      { accessorKey:'WorkShopID', header: t('timeLossTable.workshop'), meta:{field:'WorkShopID' as keyof TimeLossRow}, cell: ({row}) =>
          <SelectCell lang={lang} value={row.original.WorkShopID} options={wsOpts}
                      onChange={(v)=>handleChange(row.original,'WorkShopID', v)} /> },

      { accessorKey:'WorkCenterID', header: t('timeLossTable.workCenter'), meta:{field:'WorkCenterID' as keyof TimeLossRow}, cell: ({row}) => {
          const ws = row.original.WorkShopID;
          const options = wcOptionsByWS[ws] ?? [];
          return <SelectCell lang={lang} value={row.original.WorkCenterID} options={options}
                             onChange={(v)=>{ handleChange(row.original,'WorkCenterID', v); ensureWidth('WorkCenterID', row.original);} } />;
        }},

      { accessorKey:'DirectnessID', header: t('timeLossTable.lossType'), meta:{field:'DirectnessID' as keyof TimeLossRow}, cell: ({row}) =>
          <SelectCell lang={lang} value={row.original.DirectnessID} options={dicts?.directness ?? []}
                      onChange={(v)=>{ handleChange(row.original,'DirectnessID', Number(v)); ensureWidth('DirectnessID', row.original); }} /> },

      { accessorKey:'ReasonGroupID', header: t('timeLossTable.lossReason'), meta:{field:'ReasonGroupID' as keyof TimeLossRow}, cell: ({row}) => {
          const ws = row.original.WorkShopID;
          const options = rgOptionsByWS[ws] ?? [];
          return <SelectCell lang={lang} value={row.original.ReasonGroupID} options={options}
                             onChange={(v)=>{ handleChange(row.original,'ReasonGroupID', Number(v)); ensureWidth('ReasonGroupID', row.original); }} />;
        }},

      { accessorKey:'CommentText', header: t('timeLossTable.comment'), meta:{field:'CommentText' as keyof TimeLossRow}, cell: ({row}) =>
          <TextCell value={row.original.CommentText} onChange={(v)=>{ handleChange(row.original,'CommentText', v); ensureWidth('CommentText', row.original);} } /> },

      { accessorKey:'ManHours', header: t('timeLossTable.manHours'), meta:{field:'ManHours' as keyof TimeLossRow}, cell: ({row}) =>
          <NumberCell value={row.original.ManHours} onChange={(v)=>{ handleChange(row.original,'ManHours', v); ensureWidth('ManHours', row.original);} } /> },

      { accessorKey:'ActionPlan', header: t('timeLossTable.actionPlan'), meta:{field:'ActionPlan' as keyof TimeLossRow}, cell: ({row}) =>
          <TextCell value={row.original.ActionPlan} onChange={(v)=>{ handleChange(row.original,'ActionPlan', v); ensureWidth('ActionPlan', row.original);} } /> },

      { accessorKey:'Responsible', header: t('timeLossTable.responsible'), meta:{field:'Responsible' as keyof TimeLossRow}, cell: ({row}) =>
          <TextCell value={row.original.Responsible} onChange={(v)=>{ handleChange(row.original,'Responsible', v); ensureWidth('Responsible', row.original);} } /> },

      { accessorKey:'CompletedDate', header: t('timeLossTable.completedDate'), meta:{field:'CompletedDate' as keyof TimeLossRow}, cell: ({row}) =>
          <DateCell value={row.original.CompletedDate} onChange={(v)=>{ handleChange(row.original,'CompletedDate', v); ensureWidth('CompletedDate', row.original);} } /> },

      { id:'actions', header:'', cell: ({row}) => (
          <div className="flex gap-2 items-center">
            <button
              className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
              onClick={()=>toggleDelete(row.original._lid)}
              title={row.original._isDeleted ? (t('timeLossTable.undo')||'Undo') : (t('timeLossTable.delete')||'Delete')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        )}
    ];
  }, [dicts, handleChange, t, wcOptionsByWS, rgOptionsByWS]);

  const table = useReactTable<LocalRow>({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  // Автоматический расчёт ширины колонок (в пикселях) по максимальной длине контента
  const columnWidths = useMemo(() => {
    const widths: Record<string, number> = {};
    // измеритель текста через canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const measure = (text: string) => {
      if (!ctx) return text.length * 9;
      // Tailwind text-sm по умолчанию ~14px
      ctx.font = '14px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
      return ctx.measureText(text).width;
    };

    const cols = columns as any[];
    const baseMin: Partial<Record<keyof TimeLossRow, number>> = {
      OnlyDate: 120,
      CompletedDate: 140,
      WorkShopID: 160,
      WorkCenterID: 200,
      CommentText: 500,
      ActionPlan: 240,
    };

    cols.forEach(col => {
      const key = (col.meta?.field || col.accessorKey) as keyof TimeLossRow | undefined;
      if (!key) return;
      const headerText = typeof col.header === 'string' ? col.header : String(col.accessorKey ?? key);
      let maxW = measure(headerText);

      // учитываем все варианты из словарей, не только текущие значения в данных
      const langAll = i18n.language || 'zh';
      if (key === 'WorkShopID') {
        for (const o of (dicts?.workshops ?? [])) {
          const w = measure(getDictLabel(o, langAll));
          if (w > maxW) maxW = w;
        }
      } else if (key === 'WorkCenterID') {
        const allWC = Object.values(dicts?.workcentersByWS ?? {}).flat();
        for (const o of allWC) {
          const w = measure(getDictLabel(o, langAll));
          if (w > maxW) maxW = w;
        }
      } else if (key === 'DirectnessID') {
        for (const o of (dicts?.directness ?? [])) {
          const w = measure(getDictLabel(o, langAll));
          if (w > maxW) maxW = w;
        }
      } else if (key === 'ReasonGroupID') {
        const allRG = Object.values(dicts?.reasonGroupsByWS ?? {}).flat();
        for (const o of allRG) {
          const w = measure(getDictLabel(o, langAll));
          if (w > maxW) maxW = w;
        }
      }
      for (const r of rows) {
        const shown = displayText(key, r as any, dicts, i18n.language || 'zh');
        const w = measure(shown);
        if (w > maxW) maxW = w;
      }
      // больше отступ для select-колонок (учитываем стрелку/внутренние отступы браузера)
      const SELECT_ARROW_PX = 18; // ориентировочная ширина стрелки/индикатора
      const selectCols = new Set<keyof TimeLossRow>(['WorkShopID','WorkCenterID','DirectnessID','ReasonGroupID']);
      const padding = selectCols.has(key) ? (60 + SELECT_ARROW_PX) : 28; // px
      const minW = baseMin[key] ?? 110;
      widths[String(key)] = Math.max(minW, Math.ceil(maxW + padding));
    });
    return widths;
  }, [rows, columns, dicts, i18n.language]);

  // Ручные расширения колонки (моментально при вводе)
  const [manualWidths, setManualWidths] = useState<Record<string, number>>({});
  const ensureWidth = useCallback((field: keyof TimeLossRow, row: LocalRow) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const measure = (text: string) => {
      if (!ctx) return text.length * 9;
      ctx.font = '14px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
      return ctx.measureText(text).width;
    };
    const s = displayText(field, row, dicts, i18n.language || 'zh');
    const padding = 28;
    const minW = { OnlyDate:120, CompletedDate:140, WorkShopID:160, WorkCenterID:200, CommentText:240, ActionPlan:240 } as any;
    let w = Math.max(measure(String(field)), measure(s)) + padding;
    const min = ((minW as any)[field] !== undefined ? (minW as any)[field] : 110);
    if (w < min) w = min;
    setManualWidths(prev => (w > (prev[String(field)] ?? 0) ? { ...prev, [String(field)]: Math.ceil(w) } : prev));
  }, [dicts, i18n.language]);

  const finalWidths = useMemo(() => {
    const out: Record<string, number> = { ...columnWidths };
    Object.keys(manualWidths).forEach(k => {
      out[k] = Math.max(out[k] ?? 0, manualWidths[k]);
    });
    return out;
  }, [columnWidths, manualWidths]);

  // см. onKey ниже — Excel-подобная навигация/копипаст
  // индексы листовых колонок
  const leaf = useMemo(()=> table.getVisibleLeafColumns(), [table]);
  const leafIdx = useMemo(()=>{ const m:Record<string,number>={}; leaf.forEach((c,i)=> m[c.id as string] = i); return m; }, [leaf]);

  // Excel-подобное выделение
  const [anchor, setAnchor] = useState<{r:number,c:number}|null>(null);
  const [cursor, setCursor] = useState<{r:number,c:number}|null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [copiedSel, setCopiedSel] = useState<Set<string>>(new Set());
  const gridRef = tableRef;
  const selectSingle = (r:number,c:number) => { setAnchor({r,c}); setCursor({r,c}); setSel(new Set([keyCell(r,c)])); };
  const handleMouseDown = (r:number,c:number,e:React.MouseEvent) => {
    const allowNative = isSelectArrowClick(e.target, e);
    if (!allowNative) {
        e.preventDefault();
      gridRef.current?.focus();
    }
    if (e.shiftKey && anchor) { setCursor({r,c}); setSel(makeRect(anchor.r,anchor.c,r,c)); }
    else if (e.ctrlKey || e.metaKey) {
      setSel(prev=>{ const n=new Set(prev); const k=keyCell(r,c); n.has(k)?n.delete(k):n.add(k); return n; });
      setAnchor({r,c}); setCursor({r,c});
    } else { selectSingle(r,c); }
  };
  const handleMouseOver = (r:number,c:number,pressed:boolean) => { if (pressed && anchor) { setCursor({r,c}); setSel(makeRect(anchor.r,anchor.c,r,c)); } };

  const editableFields = new Set<keyof TimeLossRow>(['OnlyDate','WorkShopID','WorkCenterID','DirectnessID','ReasonGroupID','CommentText','ManHours','ActionPlan','Responsible','CompletedDate']);

  // преобразование вставляемого текста
  const byIdOrLabel = (list: DictItem[] = [], s: string) => {
    const low = s.toLowerCase();
    return list.find(x =>
      String(x.value).toLowerCase() === low ||
      (x.label && (x.label as any).toLowerCase?.() === low) ||
      (x.labelEn && (x.labelEn as any).toLowerCase?.() === low) ||
      (x.labelZh && (x.labelZh as any).toLowerCase?.() === low)
    );
  };

  const parseClip = useCallback((field:keyof TimeLossRow, text:string, row:LocalRow) => {
    const s = text.trim();
    if (s==='') return null;
    if (field==='ManHours') return Number(s.replace(',','.'));
    if (field==='OnlyDate' || field==='CompletedDate') return normalizeDate(s);
    if (field==='WorkShopID') { const list = dicts?.workshops ?? []; const by = byIdOrLabel(list, s); return by ? String(by.value) : s; }
    if (field==='WorkCenterID') { const list = dicts?.workcentersByWS[row.WorkShopID] ?? []; const by = byIdOrLabel(list, s); return by ? String(by.value) : s; }
    if (field==='DirectnessID') { const list = dicts?.directness ?? []; const by = byIdOrLabel(list, s); return by ? Number(by.value) : Number(s); }
    if (field==='ReasonGroupID') { const list = dicts?.reasonGroupsByWS[row.WorkShopID] ?? []; const by = byIdOrLabel(list, s); return by ? Number(by.value) : Number(s); }
    return s;
  }, [dicts]);

  const filteredRows = useMemo(()=> table.getRowModel().rows.map(r=>r.original), [table, rows]);

  const isPrintableKey = (e: React.KeyboardEvent) => e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
  const getStartCellPos = () => {
    if (sel.size > 0) {
      const coords = [...sel].map(k => k.split('-').map(Number));
      const r = Math.min(...coords.map(([r]) => r));
      const c = Math.min(...coords.map(([,c]) => c));
      return { r, c };
    }
    return cursor ?? { r: 0, c: 0 };
  };
  const setNativeValue = (el: HTMLInputElement | HTMLTextAreaElement, v: string) => {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, 'value');
    desc?.set?.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const focusAndType = (r:number, c:number, ch:string) => {
    const td = tableRef.current?.querySelector(`td[data-r="${r}"][data-c="${c}"]`) as HTMLTableCellElement | null;
    if (!td) return;
    const control = td.querySelector('input,textarea,select') as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
    if (!control) return;
    selectSingle(r, c);
    if (control instanceof HTMLSelectElement) {
      if (ch) {
        const lc = ch.toLowerCase();
        const match = Array.from(control.options).find(o => o.text.toLowerCase().startsWith(lc) || o.value.toLowerCase().startsWith(lc));
        if (match) {
          control.value = match.value;
          control.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
      control.focus();
      return;
    }
    control.focus();
    setNativeValue(control as any, ch);
    (control as HTMLInputElement).setSelectionRange?.(ch.length, ch.length);
  };

  const onKey = useCallback(async (e:React.KeyboardEvent<HTMLDivElement>) => {
    if (isFormEl(e.target)) return; // не перехватываем, когда пользователь печатает в контроле
    if (!leaf.length) return;

    // Печать/очистка — старт редактирования без даблклика
    if (isPrintableKey(e) || e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      const { r, c } = getStartCellPos();
      const ch = (e.key === 'Backspace' || e.key === 'Delete') ? '' : e.key;
      focusAndType(r, c, ch);
      return;
    }

    // ESC — убрать «пунктир»
    if (e.key === 'Escape') { setCopiedSel(new Set()); return; }

    const key = e.key.toLowerCase();
    const isCopy = (e.ctrlKey||e.metaKey) && (key==='c' || (e as any).code==='KeyC');
    if (isCopy && sel.size) {
      e.preventDefault();
      const map:Record<number,Record<number,string>> = {};
      sel.forEach(k=>{ const [r,c] = k.split('-').map(Number); map[r] ??= {}; const col = leaf[c]; const field = (col.columnDef as any).meta?.field as keyof TimeLossRow|undefined; const val = (filteredRows[r] as any)?.[field ?? (col.id as any)]; map[r][c] = val==null ? '' : String(val); });
      const rowsIdx = Object.keys(map).map(Number).sort((a,b)=>a-b);
      const colsIdx = [...new Set(Object.values(map).flatMap(o=>Object.keys(o).map(Number)))].sort((a,b)=>a-b);
      const tsv = rowsIdx.map(r=>colsIdx.map(c=>map[r][c] ?? '').join('\t')).join('\n');
      await navigator.clipboard.writeText(tsv).catch(()=>{});
      setCopiedSel(new Set(sel));
      return;
    }

    const isPaste = (e.ctrlKey||e.metaKey) && (key==='v' || (e as any).code==='KeyV');
    if (isPaste) {
      e.preventDefault();
      const text = await navigator.clipboard.readText(); if (!text) return;
      const lines = text.replace(/\r/g,'').split('\n');
      const grid = lines.map(l=>l.split('\t'));
      const startR = (anchor?.r ?? 0); const startC = (anchor?.c ?? 0);
      let targets:Set<string>;
      if (sel.size>1) { const rr=[...sel].map(k=>Number(k.split('-')[0])); const cc=[...sel].map(k=>Number(k.split('-')[1])); targets = makeRect(Math.min(...rr), Math.min(...cc), Math.max(...rr), Math.max(...cc)); }
      else { targets = makeRect(startR,startC,startR+grid.length-1,startC+Math.max(...grid.map(r=>r.length))-1); }
      const coords = [...targets].map(k=>k.split('-').map(Number) as [number,number]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
      const minR = Math.min(...coords.map(c=>c[0])); const minC = Math.min(...coords.map(c=>c[1]));
      for (const [r,c] of coords) {
        const row = rows[r]; if (!row) continue; const col = leaf[c]; const field = (col.columnDef as any).meta?.field as keyof TimeLossRow | undefined; if (!field || !editableFields.has(field)) continue;
        const gr = (r - minR) % grid.length; const gc = (c - minC) % grid[gr].length; const raw = grid[gr][gc] ?? ''; const val = parseClip(field, raw, row); handleChange(row, field, val);
      }
      requestAnimationFrame(()=>gridRef.current?.focus());
      return;
    }

    // Навигация стрелками
    if (!cursor) return; let {r,c} = cursor;
    if (['arrowup','arrowdown','arrowleft','arrowright'].includes(key)) { e.preventDefault(); r += key==='arrowdown'?1:key==='arrowup'?-1:0; c += key==='arrowright'?1:key==='arrowleft'?-1:0; r = Math.max(0, Math.min(rows.length-1, r)); c = Math.max(0, Math.min(leaf.length-1, c)); if (e.shiftKey && anchor) { setCursor({r,c}); setSel(makeRect(anchor.r,anchor.c,r,c)); } else { selectSingle(r,c); } }
  }, [leaf, sel, cursor, rows, filteredRows, editableFields, parseClip, anchor, getStartCellPos, focusAndType, handleChange]);

  /** ==== Рендер ==== */
  if (loading) {
    return <div className="flex justify-center items-center h-64 text-gray-600">加载中… / Загрузка…</div>;
  }
  if (error) {
    return <div className="flex justify-center items-center h-64 text-red-600">{error}</div>;
  }

  const totalManHours = rows.reduce((s, r) => s + (Number(r.ManHours) || 0), 0);

  const actions = (
    <div className="flex items-center gap-2">
      <button onClick={saveAll} className="px-4 py-1 rounded-md text-sm font-medium border bg-emerald-600 text-white hover:bg-emerald-700">
        {t('timeLossTable.save')}
      </button>
      <button
        onClick={addRow}
        className="px-4 py-1 rounded-md text-sm font-medium border transition-colors bg-[#0d1c3d] text-white border-[#0d1c3d] hover:bg-[#0b1733]"
      >
        {t('timeLossTable.addRow')}
      </button>
      <button
        onClick={reload}
        className="px-4 py-1 rounded-md text-sm font-medium border transition-colors bg-[#0d1c3d] text-white border-[#0d1c3d] hover:bg-[#0b1733]"
      >
        {t('timeLossTable.refresh')}
      </button>
    </div>
  );

  const actionsSlot = typeof document !== 'undefined' ? document.getElementById('tl-actions-slot') : null;

  return (
    <div className="space-y-3">
      {actionsSlot ? createPortal(actions, actionsSlot) : (
        <div className="flex items-center justify-between">{actions}</div>
      )}

      <div ref={tableRef} tabIndex={0} onKeyDown={onKey} className="outline-none select-none overflow-x-auto">
        <table className="min-w-max table-fixed border-collapse border border-slate-300 rounded-lg">
          <thead className="bg-slate-100">
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id}>
                {hg.headers.map(h => {
                  const colKey = (h.column.columnDef as any).meta?.field || (h.column.columnDef as any).accessorKey;
                  const w = colKey ? columnWidths[String(colKey)] : undefined;
                  return (
                    <th key={h.id}
                        style={w ? { width: w } : undefined}
                        className="px-2 py-1 text-center text-sm font-semibold text-slate-700 border border-slate-300">
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map(r => (
              <tr key={r.original._lid} className={r.original._isDeleted ? 'opacity-50 line-through' : 'odd:bg-white even:bg-slate-50'}>
                {r.getVisibleCells().map(c => {
                  const colKey = (c.column.columnDef as any).meta?.field as keyof TimeLossRow | undefined;
                  const colIdx = leafIdx[c.column.id as string];
                  const rowIdx = table.getRowModel().rows.indexOf(r);
                  const isSelected = sel.has(keyCell(rowIdx, colIdx));
                  const isEditable = !!colKey && editableFields.has(colKey);

                  return (
                    <td key={c.id}
                        data-r={rowIdx}
                        data-c={colIdx}
                        style={colKey ? { width: finalWidths[String(colKey)] } : undefined}
                        className={`relative border border-slate-300 p-0 align-middle ${isSelected ? 'bg-blue-50/70 outline outline-2 outline-blue-200' : ''}`}
                        onMouseDown={(e)=>handleMouseDown(rowIdx, colIdx, e)}
                        onMouseOver={(e)=>handleMouseOver(rowIdx, colIdx, e.buttons===1)}
                        
                        onDoubleClick={(e)=>{
                          setCopiedSel(new Set());
                          const td = e.currentTarget as HTMLElement;
                          const el = td.querySelector('input,select,textarea') as HTMLElement | null;
                          if (!el) return;
                          if (el instanceof HTMLSelectElement) {
                            el.focus(); (el as any).showPicker?.(); if (!(el as any).showPicker) el.click();
                            return;
                          }
                          el.focus();
                          placeCaretFromClick(el as HTMLInputElement | HTMLTextAreaElement, e.clientX);
                        }}>
                      <div className="px-0.5 py-[2px]">{flexRender(c.column.columnDef.cell, c.getContext())}</div>
                      {copiedSel.has(keyCell(rowIdx, colIdx)) && (
                        <div className="pointer-events-none absolute inset-0 border-2 border-slate-700 border-dashed rounded-[2px]" />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="px-2 py-1 text-sm text-slate-600 border border-slate-300" colSpan={6}>{t('total') || '合计'}</td>
              <td className="px-2 py-1 font-semibold border border-slate-300">{totalManHours.toFixed(1)}</td>
              <td className="border border-slate-300" colSpan={4} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

export default TimeLossTable;
