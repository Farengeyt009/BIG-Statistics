// DataTable.tsx – Excel-like таблица (копирование, навигация, статистика)
// ----------------------------------------------------------------------

import React, {
  useState,
  useMemo,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import {
  ColumnDef,
  RowData,
  Table,
  flexRender,
  useReactTable,
  getCoreRowModel,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { DndContext, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import FilterPopover from './FilterPopover';

// Форматтер для отображения чисел как целых (0 знаков после запятой)
const fmtInt = new Intl.NumberFormat('ru-RU', {
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

/* ------------------------------------------------------------------ */
/*                                TYPES                               */
/* ------------------------------------------------------------------ */
export interface DataTableProps<T extends RowData> {
  data: T[];
  columnsOverrides?: Record<string, Partial<ColumnDef<T>>>;
  columnsOrder?: string[];
  onTableReady?: (table: Table<T>) => void;
  virtualized?: boolean | { overscan?: number };
  numericKeys?: string[];
  language?: 'en' | 'zh';
}

type Stats =
  | null
  | { count: number; numCount: number; sum: number; avg: number | null };

// Расширенный тип метаданных для колонки
export interface ColumnMetaEx {
  excelHeader?: string;
  charWidth?: number;
}

/* ------------------------------------------------------------------ */
/*                     helpers для selection/copy                      */
/* ------------------------------------------------------------------ */
const keyCell = (r: number, c: number) => `${r}-${c}`;

const makeRect = (r1: number, c1: number, r2: number, c2: number) => {
  const [rs, re] = r1 < r2 ? [r1, r2] : [r2, r1];
  const [cs, ce] = c1 < c2 ? [c1, c2] : [c2, c1];
  const set = new Set<string>();
  for (let r = rs; r <= re; r++)
    for (let c = cs; c <= ce; c++) set.add(keyCell(r, c));
  return set;
};

/* ------------------------------------------------------------------ */
/*                     helpers для определения языка                   */
/* ------------------------------------------------------------------ */
// Функция для определения языка содержимого колонки
const detectColumnLanguage = (data: any[], columnId: string): 'en' | 'zh' => {
  if (!data.length) return 'en';
  
  // Проверяем первые 10 строк для определения языка
  const sampleSize = Math.min(10, data.length);
  let chineseCount = 0;
  let totalCount = 0;
  
  for (let i = 0; i < sampleSize; i++) {
    const value = String(data[i]?.[columnId] ?? '');
    if (value.trim()) {
      totalCount++;
      // Проверяем наличие китайских символов
      if (/[\u4e00-\u9fff]/.test(value)) {
        chineseCount++;
      }
    }
  }
  
  // Если больше 30% значений содержат китайские символы, считаем колонку китайской
  return (chineseCount / totalCount) > 0.3 ? 'zh' : 'en';
};

/* ------------------------------------------------------------------ */
/*                         MAIN COMPONENT                             */
/* ------------------------------------------------------------------ */
export function DataTable<T extends Record<string, any>>({
  data,
  columnsOverrides = {},
  columnsOrder,
  onTableReady,
  virtualized = true,
  numericKeys,
  language = 'en',
}: DataTableProps<T>) {
  /* --------------------------- фильтры --------------------------- */
  const [filters, setFilters] = useState<Record<string, string[]>>({});

  const filteredData = useMemo(() => {
    if (!data.length) return [];
    return data.filter((row) =>
      Object.keys(row).every(
        (k) =>
          !filters[k]?.length || filters[k].includes(String(row[k] ?? '')),
      ),
    );
  }, [data, filters]);

  const uniqueByKey = useMemo(() => {
    const map: Record<string, string[]> = {};
    if (!data.length) return map;
    Object.keys(data[0]).forEach((k) => {
      const subset = data.filter((row) =>
        Object.keys(row).every(
          (key) =>
            key === k ||
            !filters[key]?.length ||
            filters[key].includes(String(row[key] ?? '')),
        ),
      );
      map[k] = [...new Set(subset.map((r) => String(r[k] ?? '')))].sort();
    });
    return map;
  }, [data, filters]);

  /* -------------------- numeric cols & sums -------------------- */
  const numericCols = useMemo(() => {
    if (!filteredData.length) return [];
    const cand = numericKeys ?? Object.keys(filteredData[0]);
    return cand.filter((k) =>
      filteredData.every(
        (r) => r[k] === '' || r[k] === null || !isNaN(Number(r[k])),
      ),
    );
  }, [filteredData, numericKeys]);

  const numericSums = useMemo(() => {
    const sums: Record<string, number> = {};
    numericCols.forEach(
      (k) => (sums[k] = filteredData.reduce((a, r) => a + (+r[k] || 0), 0)),
    );
    return sums;
  }, [filteredData, numericCols]);

  /* ------------------------ columns ------------------------ */
  const columns = useMemo<ColumnDef<T>[]>(() => {
    if (!data.length) return [];
    const base = Object.keys(data[0]).map((k) => ({ id: k, accessorKey: k }));
    let merged = base.map((c) => ({ ...c, ...(columnsOverrides[c.id] ?? {}) }));

    if (columnsOrder?.length) {
      merged = merged.filter((c) => columnsOrder.includes(c.id as string));
      merged.sort(
        (a, b) =>
          columnsOrder.indexOf(a.id as string) -
          columnsOrder.indexOf(b.id as string),
      );
    }

    return merged.map((c) => {
      const hdr =
        typeof c.header === 'string'
          ? (c.header as string)
          : (columnsOverrides[c.id]?.header as string) ?? (c.id as string);

      return {
        ...c,
        meta: { ...c.meta, excelHeader: c.meta?.excelHeader ?? hdr },
        header: () => (
          <>
            {hdr}
            <FilterPopover
              columnId={c.id}
              data={filteredData}
              uniqueValues={uniqueByKey[c.id] ?? []}
              selectedValues={filters[c.id] ?? []}
              onFilterChange={(sel) =>
                setFilters((p) => ({ ...p, [c.id]: sel }))
              }
            />
          </>
        ),
      } as ColumnDef<T>;
    });
  }, [data, columnsOverrides, columnsOrder, filteredData, filters, uniqueByKey]);

  /* -------------------- react-table -------------------- */
  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });
  useEffect(() => onTableReady?.(table), [table, onTableReady]);

  /* -------------------- virtualizer -------------------- */
  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirt = useVirtualizer({
    count: filteredData.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 34,
    overscan:
      typeof virtualized === 'object' ? virtualized.overscan ?? 10 : 10,
  });
  const vRows = rowVirt.getVirtualItems();
  const padTop = vRows[0]?.start ?? 0;
  const padBot = rowVirt.getTotalSize() - (vRows.at(-1)?.end ?? 0);

  /* -------------------- col widths -------------------- */
  const colWidths = useMemo(() => {
    if (!filteredData.length) return {};
    const base = 16;
    const filterIconWidth = language === 'zh' ? 35 : 20; // ← было 20 / 16
    const map: Record<string, number> = {};
    columns.forEach((c) => {
      const id = c.id as string;
      const headerLen = (c.meta?.excelHeader ?? id).toString().length;
      
      // Используем meta.charWidth если задан, иначе определяем язык автоматически
      const meta = c.meta as ColumnMetaEx | undefined;
      let charForColumn = meta?.charWidth;
      
      if (charForColumn === undefined) {
        // Автоматическое определение языка для колонки
        const columnLanguage = detectColumnLanguage(filteredData, id);
        charForColumn = columnLanguage === 'zh' ? 12 : 8;
      }
      
      // Расчет ширины заголовка с учетом языка интерфейса
      const headerText = (c.meta?.excelHeader ?? id).toString();
      const headerHasChinese = /[\u4e00-\u9fff]/.test(headerText);
      const headerCharWidth = headerHasChinese ? 12 : 8;
      const headerWidthNoIcon = headerLen * headerCharWidth + base;
      
      const maxCell = filteredData.reduce((m, r) => {
        const value = r[id];
        let displayValue = String(value ?? '');
        if (numericCols.includes(id)) {
          if (value !== '' && value !== null && value !== undefined) {
            displayValue = Number(value).toLocaleString('ru-RU');
          } else {
            displayValue = '';
          }
        }
        return Math.max(m, displayValue.length);
      }, 0);
      
      const dataWidth = maxCell * charForColumn + base;

      // итог: берём большее из header/data и ДОБАВЛЯЕМ запас под иконку
      const widthCore = Math.max(headerWidthNoIcon, dataWidth);
      map[id] = Math.min(Math.max(widthCore + filterIconWidth, 80), 400);
      
      // Отладочная информация для колонки DATE
      if (id === 'OnlyDate') {
        console.log(`Column ${id}:`, {
          headerText,
          headerLen,
          headerCharWidth,
          headerWidthNoIcon,
          maxCell,
          charForColumn,
          dataWidth,
          widthCore,
          finalWidth: map[id]
        });
      }
    });
    return map;
  }, [columns, filteredData, language, numericCols]);

  /* ---------------- selection state ---------------- */
  const leaf = table.getVisibleLeafColumns();
  const leafIdx: Record<string, number> = {};
  leaf.forEach((c, i) => (leafIdx[c.id as string] = i));

  const [anchor, setAnchor] = useState<{ r: number; c: number } | null>(null);
  const [cursor, setCursor] = useState<{ r: number; c: number } | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());

  const focusGrid = () => parentRef.current?.focus();

  const selectSingle = (r: number, c: number) => {
    setAnchor({ r, c });
    setCursor({ r, c });
    setSel(new Set([keyCell(r, c)]));
  };

  /* ---------------- stats for banner ---------------- */
  const stats: Stats = useMemo(() => {
    if (sel.size <= 1) return null;

    let count = 0,
      numCount = 0,
      sum = 0;

    sel.forEach((k) => {
      const [rr, cc] = k.split('-').map(Number);
      const raw = filteredData[rr]?.[leaf[cc].id as string];
      count++;

      const n = Number(raw);
      if (!isNaN(n) && raw !== '' && raw !== null) {
        numCount++;
        sum += n;
      }
    });

    return { count, numCount, sum, avg: numCount ? sum / numCount : null };
  }, [sel, filteredData, leaf]);

  /* ---------------- mouse ---------------- */
  const handleMouseDown = (r: number, c: number, e: React.MouseEvent) => {
    e.preventDefault();
    focusGrid();

    if (e.shiftKey && anchor) {
      setCursor({ r, c });
      setSel(makeRect(anchor.r, anchor.c, r, c));
    } else if (e.ctrlKey || e.metaKey) {
      setSel((prev) => {
        const n = new Set(prev);
        const k = keyCell(r, c);
        n.has(k) ? n.delete(k) : n.add(k);
        return n;
      });
      setAnchor({ r, c });
      setCursor({ r, c });
    } else {
      selectSingle(r, c);
    }
  };

  const handleMouseOver = (r: number, c: number, pressed: boolean) => {
    if (pressed && anchor) {
      setCursor({ r, c });
      setSel(makeRect(anchor.r, anchor.c, r, c));
    }
  };

  /* ---------------- keyboard ---------------- */
  const handleKey = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const { key, code, shiftKey, ctrlKey, metaKey } = e;

      /* --- copy --- */
      const keyLower = key.toLowerCase();
      const isCopy =
        (ctrlKey || metaKey) &&
        (code === 'KeyC' || keyLower === 'c' || keyLower === 'с');

      if (isCopy) {
        if (!sel.size) return;
        e.preventDefault();

        const rows: Record<number, Record<number, string>> = {};
        sel.forEach((k) => {
          const [rr, cc] = k.split('-').map(Number);
          rows[rr] ??= {};
          rows[rr][cc] = String(filteredData[rr][leaf[cc].id as string] ?? '');
        });

        const allCols = [
          ...new Set(
            Object.values(rows).flatMap((r) => Object.keys(r).map(Number)),
          ),
        ].sort((a, b) => a - b);

        const tsv = Object.keys(rows)
          .map(Number)
          .sort((a, b) => a - b)
          .map((rr) =>
            allCols
              .map((cc) => rows[rr][cc] ?? '')
              .join('\t'),
          )
          .join('\n');

        navigator.clipboard?.writeText(tsv).catch(() => {
          const ta = document.createElement('textarea');
          ta.value = tsv;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.focus();
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
        });

        return requestAnimationFrame(() => parentRef.current?.focus());
      }

      /* --- navigation --- */
      if (!cursor) return;
      let { r, c } = cursor;
      switch (key) {
        case 'ArrowUp':
          r = Math.max(0, r - 1);
          break;
        case 'ArrowDown':
          r = Math.min(filteredData.length - 1, r + 1);
          break;
        case 'ArrowLeft':
          c = Math.max(0, c - 1);
          break;
        case 'ArrowRight':
          c = Math.min(leaf.length - 1, c + 1);
          break;
        default:
          return;
      }
      e.preventDefault();

      if (shiftKey && anchor) {
        setCursor({ r, c });
        setSel(makeRect(anchor.r, anchor.c, r, c));
      } else {
        selectSingle(r, c);
      }

      rowVirt.scrollToIndex(r);
      requestAnimationFrame(() => parentRef.current?.focus());
    },
    [anchor, cursor, sel, filteredData, leaf, rowVirt],
  );

  /* --------------------------- RENDER --------------------------- */
  return (
    <DndContext
      onDragEnd={({ active, over }: DragEndEvent) => {
        if (!over || active.id === over.id) return;
        table.setColumnOrder((prev) =>
          arrayMove(
            prev,
            prev.indexOf(active.id as string),
            prev.indexOf(over.id as string),
          ),
        );
      }}
    >
      <>
        <div
          ref={parentRef}
          tabIndex={0}
          onKeyDown={handleKey}
          className="max-h-[80vh] overflow-auto border bg-white focus:outline-none"
        >
          <table className="min-w-max w-max text-sm border-collapse select-none">
          <colgroup>
              {leaf.map((col) => (
                <col
                  key={col.id}
                  style={{ width: `${colWidths[col.id as string]}px` }}
                />
              ))}
          </colgroup>

          {/* thead */}
            <thead className={`sticky top-0 bg-slate-100 uppercase font-semibold ${language === 'zh' ? 'text-[14px]' : 'text-[11px]'}`}>
              <SortableContext items={table.getState().columnOrder}>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((h) => (
                      <ThSortable key={h.id} id={h.id as string}>
                      {flexRender(h.column.columnDef.header, h.getContext())}
                      </ThSortable>
                  ))}
                </tr>
              ))}
            </SortableContext>
          </thead>

          {/* tbody */}
          <tbody>
              {padTop > 0 && (
                <tr style={{ height: padTop }}>
                  <td />
              </tr>
            )}

              {vRows.map((vr) => {
                const row = table.getRowModel().rows[vr.index];
              return (
                  <tr key={row.id} style={{ height: vr.size }}>
                  {row.getVisibleCells().map((cell) => {
                      const colIdx = leafIdx[cell.column.id as string];
                      const k = keyCell(vr.index, colIdx);
                      const isSel = sel.has(k);

                      const isNum = numericCols.includes(
                        cell.column.id as string,
                      );
                      const raw = cell.getValue();
                      const display = isNum
                        ? raw !== '' && raw !== null && raw !== undefined
                          ? fmtInt.format(Number(raw))                // ← визуально целые
                          : ''
                        : flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          );

                    return (
                      <td
                        key={cell.id}
                          onMouseDown={(e) =>
                            handleMouseDown(vr.index, colIdx, e)
                          }
                          onMouseOver={(e) =>
                            handleMouseOver(
                              vr.index,
                              colIdx,
                              e.buttons === 1,
                            )
                          }
                          className={`border-t px-3 py-1 whitespace-nowrap ${
                            isNum ? 'text-right tabular-nums' : ''
                          } ${
                            isSel
                              ? 'bg-blue-50/70 outline outline-2 outline-blue-200'
                              : ''
                          }`}
                          title={isNum && raw !== null && raw !== undefined ? String(raw) : undefined}
                      >
                        {display}
                      </td>
                    );
                  })}
                </tr>
              );
            })}

              {padBot > 0 && (
                <tr style={{ height: padBot }}>
                  <td />
              </tr>
            )}
          </tbody>

            {/* tfoot */}
            {!!filteredData.length && !!numericCols.length && (
            <tfoot className="bg-slate-50">
              <tr>
                  {leaf.map((c) =>
                    numericCols.includes(c.id as string) ? (
                      <td
                        key={c.id}
                        className="border-t text-right font-semibold"
                      >
Испраув                        {fmtInt.format(numericSums[c.id as string])}     // ← визуально целые
                    </td>
                  ) : (
                      <td key={c.id} />
                  ),
                )}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

        {/* stats banner */}
        <StatsBanner stats={stats} />
      </>
    </DndContext>
  );
}

/* ------------------------------------------------------------------ */
/*               Баннер с количеством, суммой, средним                */
/* ------------------------------------------------------------------ */
function StatsBanner({ stats }: { stats: Stats }) {
  if (!stats) return null;

  const { count, numCount, sum, avg } = stats;
  return (
    <div
      className="fixed bottom-4 right-4 bg-slate-800 text-white text-xs
                 rounded shadow-lg px-3 py-2 space-x-3 pointer-events-none
                 select-none z-50"
    >
      <span>{count} яч.</span>
      {numCount > 0 && (
        <>
          <span>Σ {sum.toLocaleString('ru-RU')}</span>
          <span>
            ̅x {avg!.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}
          </span>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*                         Draggable TH                               */
/* ------------------------------------------------------------------ */
function ThSortable({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, attributes, listeners, transform, transition } =
    useSortable({ id });
  return (
    <th
      ref={setNodeRef}
      {...attributes}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="px-3 py-[10px] text-center first:rounded-tl-lg last:rounded-tr-lg"
    >
      <span {...listeners} className="cursor-move">
          {children}
        </span>
    </th>
  );
} 
