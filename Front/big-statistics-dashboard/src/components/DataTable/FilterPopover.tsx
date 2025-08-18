import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useFloating, offset, shift, autoUpdate } from '@floating-ui/react';

/* ─────────────────────────── Types ─────────────────────────── */
interface FilterPopoverProps {
  columnId: string;
  data?: any[];                     // не нужен, но оставляем для совместимости
  uniqueValues: string[];
  selectedValues: string[];
  onFilterChange: (selected: string[]) => void;
}

type DataType = 'date' | 'number' | 'string';
type ParsedDate = { y: number; m: number; d: number; raw: string };

/* ─────────────────────── Helpers: dates ─────────────────────── */
const RU_MONTHS = [
  '',
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
];

const pad2 = (n: number) => (n < 10 ? `0${n}` : String(n));

/** true ⇢ год «реалистичный» */
const validYear = (y: number) => y >= 1900 && y <= 2100;

/** Парсим популярные форматы дат; проверяем год */
function tryParseDate(raw: string): ParsedDate | null {
  if (!raw) return null;
  const v = String(raw).trim();

  // dd.MM.yyyy  /  yyyy.MM.dd
  if (v.includes('.')) {
    const p = v.split('.').map((s) => s.trim());
    if (p.length >= 3) {
      // dd.MM.yyyy
      if (p[2].length === 4) {
        const d = Number(p[0]), m = Number(p[1]), y = Number(p[2]);
        if (validYear(y) && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
          return { y, m, d, raw };
        }
      }
      // yyyy.MM.dd
      if (p[0].length === 4) {
        const y = Number(p[0]), m = Number(p[1]), d = Number(p[2]);
        if (validYear(y) && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
          return { y, m, d, raw };
        }
      }
    }
  }

  // yyyy-MM-dd
  if (v.includes('-')) {
    const p = v.split('-').map((s) => s.trim());
    if (p.length >= 3 && p[0].length === 4) {
      const y = Number(p[0]), m = Number(p[1]), d = Number(p[2]);
      if (validYear(y) && m >= 1 && m <= 12 && d >= 1 && d <= 31)
        return { y, m, d, raw };
    }
  }

  // dd/MM/yyyy (если первый > 12)
  if (v.includes('/')) {
    const p = v.split('/').map((s) => s.trim());
    if (p.length >= 3) {
      if (p[2].length === 4) {
        const a = Number(p[0]), b = Number(p[1]), c = Number(p[2]);
        // dd/MM/yyyy
        if (a > 12 && validYear(c) && b >= 1 && b <= 12 && a <= 31) {
          return { y: c, m: b, d: a, raw };
        }
      }
    }
  }

  return null;
}

/** Определяем тип колонки */
function detectDataType(values: string[]): DataType {
  let dateHits = 0, numberHits = 0, total = 0;
  for (const v of values) {
    if (v === '' || v === null || v === undefined) continue;
    total++;
    if (tryParseDate(String(v))) dateHits++;
    else if (!isNaN(Number(v))) numberHits++;
  }
  if (total && dateHits / total >= 0.7) return 'date';
  if (total && numberHits / total >= 0.9) return 'number';
  return 'string';
}

/* ───────────────── Tri-checkbox helper ───────────────── */
function TriCheckbox({
  state,
  onChange,
  children,
  className,
}: {
  state: boolean | 'indeterminate';
  onChange: (checked: boolean) => void;
  children?: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = state === 'indeterminate';
  }, [state]);
  return (
    <label className={`flex items-center gap-2 cursor-pointer ${className ?? ''}`}>
      <input
        ref={ref}
        type="checkbox"
        checked={state === true}
        onChange={(e) => onChange(e.target.checked)}
      />
      {children}
    </label>
  );
}

/* ───────────────────────── Component ───────────────────────── */
const FilterPopover: React.FC<FilterPopoverProps> = ({
  columnId,
  uniqueValues,
  selectedValues,
  onFilterChange,
}) => {
  const { t } = useTranslation('dataTable');

  /* UI state */
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<Set<string>>(new Set(selectedValues.length ? selectedValues : uniqueValues));

  /* floating-ui */
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const { refs, floatingStyles, update } = useFloating({
    placement: 'bottom-start',
    middleware: [offset(4), shift()],
    whileElementsMounted: autoUpdate,
  });
  useEffect(() => refs.setReference(btnRef.current), [refs]);

  useEffect(() => {
    if (open) {
      setDraft(new Set(selectedValues.length ? selectedValues : uniqueValues));
      update();
    }
  }, [open, selectedValues, uniqueValues, update]);

  /* закрытие при клике вне */
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (btnRef.current?.contains(e.target as Node)) return;
      if (refs.floating.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open, refs.floating]);

  /* подготовка данных по типу */
  const dataType = useMemo(() => detectDataType(uniqueValues), [uniqueValues]);

  const numericValues = useMemo(() => {
    if (dataType !== 'number') return [];
    const nums = uniqueValues
      .filter((v) => v !== '' && v !== null && v !== undefined)
      .sort((a, b) => Number(a) - Number(b));          // ↑ по возрастанию
    const empties = uniqueValues.filter((v) => v === '' || v === null || v === undefined);
    return [...nums, ...empties];
  }, [dataType, uniqueValues]);

  const dateTree = useMemo(() => {
    if (dataType !== 'date') return null as null | Record<number, Record<number, ParsedDate[]>>;
    const parsed: ParsedDate[] = [];
    uniqueValues.forEach((raw) => {
      const d = tryParseDate(raw);
      if (d) parsed.push(d);
    });
    const tree: Record<number, Record<number, ParsedDate[]>> = {};
    parsed.forEach((d) => {
      (tree[d.y] ??= {}), (tree[d.y][d.m] ??= []).push(d);
    });
    Object.values(tree).forEach((months) =>
      Object.values(months).forEach((arr) => arr.sort((a, b) => a.d - b.d)),
    );
    return tree;
  }, [dataType, uniqueValues]);

  const [openYears, setOpenYears] = useState<Set<number>>(new Set());
  const [openMonths, setOpenMonths] = useState<Set<string>>(new Set());

  /* раскрыть всё при поиске */
  useEffect(() => {
    if (search && dataType === 'date' && dateTree) {
      setOpenYears(new Set(Object.keys(dateTree).map(Number)));
      setOpenMonths(
        new Set(
          Object.entries(dateTree).flatMap(([y, months]) =>
            Object.keys(months).map((m) => `${y}-${m}`),
          ),
        ),
      );
    }
  }, [search, dataType, dateTree]);

  /* Select-all indeterminate */
  const selectAllRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (selectAllRef.current) {
      const cnt = draft.size;
      selectAllRef.current.indeterminate = cnt > 0 && cnt < uniqueValues.length;
    }
  }, [draft, uniqueValues]);

  const q = search.trim().toLowerCase();

  /* ───────────────────────── Render ───────────────────────── */
  return (
    <div className="relative inline-block">
      {/* trigger */}
      <button
        ref={btnRef}
        className={`text-gray-400 hover:text-blue-600 ${selectedValues.length ? 'text-blue-600' : ''} relative`}
        /* 1️⃣  блокируем всплытие pointerdown, иначе global-listener
               посчитает, что клик вне поп-овера                 */
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => setOpen((o) => !o)}
        tabIndex={-1}
        aria-label={`Filter ${columnId}`}
      >
        <svg width="18" height="18" viewBox="0 0 28 28" fill="none" aria-hidden="true">
          <path stroke="currentColor" strokeWidth="2" d="M4 7h20M8 14h12m-6 7h.01" />
        </svg>
        {selectedValues.length > 0 && (
          <span className="absolute top-0 right-0 block w-2 h-2 bg-blue-500 rounded-full border border-white" />
        )}
      </button>

      {open &&
        createPortal(
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            className="z-[9999] bg-white border rounded shadow-lg p-3 min-w-[220px]"
            onPointerDown={(e) => e.stopPropagation()}
          >
            {/* поиск */}
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="mb-2 w-full border rounded px-2 py-1 text-xs"
              placeholder={t('search', { defaultValue: 'Search…' })}
              autoFocus
            />

            {/* select all */}
            <label className="flex items-center gap-2 text-sm cursor-pointer mb-2">
              <input
                ref={selectAllRef}
                type="checkbox"
                checked={draft.size === uniqueValues.length}
                onChange={() => {
                  setDraft(draft.size === uniqueValues.length ? new Set() : new Set(uniqueValues));
                }}
              />
              <span className="font-medium">{t('selectAll', { defaultValue: 'Select All' })}</span>
            </label>

            {/* Values */}
            <div className="overflow-y-auto max-h-60 pr-1 text-sm">
              {/* DATE tree */}
              {dataType === 'date' && dateTree && (
                <div>
                  {Object.keys(dateTree)
                    .map(Number)
                    .sort((a, b) => b - a)
                    .map((y) => {
                      const months = dateTree[y];
                      const yearRows = Object.values(months).flat().map((d) => d.raw);
                      const picked = yearRows.filter((r) => draft.has(r)).length;
                      const yearState: boolean | 'indeterminate' =
                        picked === 0 ? false : picked === yearRows.length ? true : 'indeterminate';

                      return (
                        <div key={y} className="mb-1">
                          <div className="flex items-center gap-2">
                            <button
                              className="px-1 text-gray-600 hover:text-black"
                              onClick={() =>
                                setOpenYears((s) => {
                                  const n = new Set(s);
                                  n.has(y) ? n.delete(y) : n.add(y);
                                  return n;
                                })
                              }
                            >
                              {openYears.has(y) ? '▾' : '▸'}
                            </button>
                            <TriCheckbox
                              state={yearState}
                              onChange={(checked) => {
                                const n = new Set(draft);
                                checked ? yearRows.forEach((r) => n.add(r)) : yearRows.forEach((r) => n.delete(r));
                                setDraft(n);
                              }}
                            >
                              <span className="font-medium">{y}</span>
                            </TriCheckbox>
                          </div>

                          {openYears.has(y) &&
                            Object.keys(months)
                              .map(Number)
                              .sort((a, b) => a - b)
                              .map((m) => {
                                const days = months[m];
                                const monthKey = `${y}-${m}`;
                                const monthRows = days.map((d) => d.raw);
                                const picked2 = monthRows.filter((r) => draft.has(r)).length;
                                const state2: boolean | 'indeterminate' =
                                  picked2 === 0 ? false : picked2 === monthRows.length ? true : 'indeterminate';

                                /* поиск внутри месяца */
                                const visibleDays = days.filter((d) =>
                                  q
                                    ? d.raw.toLowerCase().includes(q) ||
                                      String(d.d).includes(q) ||
                                      RU_MONTHS[m].toLowerCase().includes(q)
                                    : true,
                                );
                                if (q && visibleDays.length === 0) return null;

                                return (
                                  <div key={monthKey} className="pl-6">
                                    <div className="flex items-center gap-2">
                                      <button
                                        className="px-1 text-gray-600 hover:text-black"
                                        onClick={() =>
                                          setOpenMonths((s) => {
                                            const n = new Set(s);
                                            n.has(monthKey) ? n.delete(monthKey) : n.add(monthKey);
                                            return n;
                                          })
                                        }
                                      >
                                        {openMonths.has(monthKey) ? '▾' : '▸'}
                                      </button>
                                      <TriCheckbox
                                        state={state2}
                                        onChange={(checked) => {
                                          const n = new Set(draft);
                                          checked
                                            ? monthRows.forEach((r) => n.add(r))
                                            : monthRows.forEach((r) => n.delete(r));
                                          setDraft(n);
                                        }}
                                      >
                                        {RU_MONTHS[m]}{' '}
                                        <span className="text-xs text-gray-500">({monthRows.length})</span>
                                      </TriCheckbox>
                                    </div>

                                    {openMonths.has(monthKey) &&
                                      visibleDays.map((d) => (
                                        <label key={d.raw} className="flex items-center gap-2 pl-8 py-0.5 cursor-pointer">
                                          <input
                                            type="checkbox"
                                            checked={draft.has(d.raw)}
                                            onChange={(e) => {
                                              const n = new Set(draft);
                                              e.target.checked ? n.add(d.raw) : n.delete(d.raw);
                                              setDraft(n);
                                            }}
                                          />
                                          <span>{pad2(d.d)}</span> {/* только день */}
                                        </label>
                                      ))}
                                  </div>
                                );
                              })}
                        </div>
                      );
                    })}
                </div>
              )}

              {/* NUMBERS */}
              {dataType === 'number' &&
                numericValues
                  .filter((v) => (q ? String(v).toLowerCase().includes(q) : true))
                  .map((val) => (
                    <label key={String(val)} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={draft.has(String(val))}
                        onChange={(e) => {
                          const n = new Set(draft);
                          e.target.checked ? n.add(String(val)) : n.delete(String(val));
                          setDraft(n);
                        }}
                      />
                      <span>
                        {String(val) === '' ? <span className="italic text-gray-400">(empty)</span> : String(val)}
                      </span>
                    </label>
                  ))}

              {/* STRINGS */}
              {dataType === 'string' &&
                uniqueValues
                  .filter((v) => (q ? String(v).toLowerCase().includes(q) : true))
                  .map((val) => (
                    <label key={String(val)} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={draft.has(String(val))}
                        onChange={(e) => {
                          const n = new Set(draft);
                          e.target.checked ? n.add(String(val)) : n.delete(String(val));
                          setDraft(n);
                        }}
                      />
                      <span>
                        {String(val) === '' ? <span className="italic text-gray-400">(empty)</span> : String(val)}
                      </span>
                    </label>
                  ))}
            </div>

            {/* OK / Cancel */}
            <div className="flex justify-end gap-2 mt-3 text-xs">
              <button className="px-3 py-1 border rounded hover:bg-gray-100" onClick={() => setOpen(false)}>
                {t('cancel', { defaultValue: 'Cancel' })}
              </button>
              <button
                className="px-3 py-1 border rounded bg-blue-600 text-white disabled:bg-gray-300"
                disabled={draft.size === 0}
                onClick={() => {
                  const next = Array.from(draft);
                  onFilterChange(next.length === uniqueValues.length ? [] : next);
                  setOpen(false);
                }}
              >
                OK
              </button>
            </div>
          </div>,
          (() => {
            const root =
              document.getElementById('portal-root') ??
              (() => {
                const el = document.createElement('div');
                el.id = 'portal-root';
                document.body.appendChild(el);
                return el;
              })();
            return root;
          })(),
        )}
    </div>
  );
};

export default React.memo(FilterPopover);
