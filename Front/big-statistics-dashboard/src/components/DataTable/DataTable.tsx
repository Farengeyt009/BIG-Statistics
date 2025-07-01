import React, {
  useState,
  useMemo,
  useEffect,
  useRef,
  useLayoutEffect,
} from 'react';
import {
  ColumnDef,
  useReactTable,
  getCoreRowModel,
  flexRender,
  RowData,
  Table,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';

import { DndContext, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import FilterPopover from './FilterPopover';

/* ------------------------------------------------------------------ */
/*                             CONSTS                                 */
/* ------------------------------------------------------------------ */
const MIN_WIDTH = 80;   // px, колонка уже не станет
const MAX_WIDTH = 400;  // px, колонка шире не станет
const PX_PER_CHAR = 8;  // грубый коэффициент для Inter
const PADDING = 16;     // px, padding слева+справа

/* ------------------------------------------------------------------ */
/*                               TYPES                                */
/* ------------------------------------------------------------------ */
export interface DataTableProps<T extends RowData> {
  data: T[];
  columnsOverrides?: Record<string, Partial<ColumnDef<T>>>;
  columnsOrder?: string[];
  defaultVisible?: string[];
  onTableReady?: (table: Table<T>) => void;
  virtualized?: boolean | { overscan?: number };
}

/* ------------------------------------------------------------------ */
/*                         MAIN COMPONENT                             */
/* ------------------------------------------------------------------ */
export function DataTable<T extends Record<string, any>>({
  data,
  columnsOverrides = {},
  columnsOrder,
  defaultVisible,
  onTableReady,
  virtualized = true,
}: DataTableProps<T>) {
  /* --------------------------- filters --------------------------- */
  const [filters, setFilters] = useState<Record<string, string[]>>({});

  const filteredData = useMemo(() => {
    if (!data.length) return [];
    return data.filter((row) =>
      Object.keys(row).every((k) => {
        const selected = filters[k];
        if (!selected?.length) return true;
        return selected.includes(String(row[k] ?? ''));
      }),
    );
  }, [data, filters]);

  /** уникальные значения для FilterPopover */
  const uniqueValuesByKey = useMemo(() => {
    const res: Record<string, string[]> = {};
    if (!data.length) return res;

    Object.keys(data[0]).forEach((k) => {
      const cascade = data.filter((row) =>
        Object.keys(row).every((key) => {
          if (key === k) return true;
          const sel = filters[key];
          if (!sel?.length) return true;
          return sel.includes(String(row[key] ?? ''));
        }),
      );
      res[k] = Array.from(new Set(cascade.map((r) => String(r[k] ?? '')))).sort();
    });
    return res;
  }, [data, filters]);

  /* -------------------- numeric totals -------------------- */
  const numericColumns = useMemo<string[]>(() => {
    if (!filteredData.length) return [];
    const keys = Object.keys(filteredData[0]);
    return keys.filter((k) => filteredData.every((r) => r[k] === '' || !isNaN(Number(r[k]))));
  }, [filteredData]);

  const numericSums = useMemo<Record<string, number>>(() => {
    const sums: Record<string, number> = {};
    numericColumns.forEach((k) => {
      sums[k] = filteredData.reduce((acc, row) => acc + (Number(row[k]) || 0), 0);
    });
    return sums;
  }, [filteredData, numericColumns]);

  /* --------------------- drag & drop ---------------------- */
  const [columnOrder, setColumnOrder] = useState<string[]>([]);

  /* ----------------------- columns ----------------------- */
  const columns = useMemo<ColumnDef<T>[]>(() => {
    if (!data.length) return [];

    // 1 базовые
    const base = Object.keys(data[0]).map((k) => ({ id: k, accessorKey: k }));

    // 2 overrides
    let merged = base.map((c) => ({ ...c, ...(columnsOverrides[c.id] ?? {}) }));

    // 3 custom order
    if (columnsOrder?.length) {
      merged.sort(
        (a, b) =>
          (columnsOrder.indexOf(a.id) === -1 ? Infinity : columnsOrder.indexOf(a.id)) -
          (columnsOrder.indexOf(b.id) === -1 ? Infinity : columnsOrder.indexOf(b.id)),
      );
    }

    // 4 header + FilterPopover
    return merged.map((c) => ({
      ...c,
      header: () => (
        <>
          {typeof c.header === 'string' ? c.header : c.id}
          <FilterPopover
            columnId={c.id}
            data={filteredData}
            uniqueValues={uniqueValuesByKey[c.id] ?? []}
            selectedValues={filters[c.id] ?? []}
            onFilterChange={(sel) => setFilters((p) => ({ ...p, [c.id]: sel }))}
          />
        </>
      ),
    }));
  }, [data, columnsOverrides, columnsOrder, filteredData, filters, uniqueValuesByKey]);

  useEffect(() => {
    setColumnOrder(columns.map((c) => c.id as string));
  }, [columns]);

  /* ------------------- virtualizer ------------------- */
  const rowHeight = 34;
  const overscan = typeof virtualized === 'object' ? virtualized.overscan ?? 10 : 10;
  const scrollRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: filteredData.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan,
  });

  /* -------------------- react-table ------------------ */
  const table = useReactTable({
    data: filteredData,
    columns,
    state: { columnOrder },
    onColumnOrderChange: setColumnOrder,
    getCoreRowModel: getCoreRowModel(),
  });

  useEffect(() => onTableReady?.(table), [table, onTableReady]);

  /* ------------------------------------------------------------------ */
  /*          1) базовая ширина (по контенту)                            */
  /* ------------------------------------------------------------------ */
  const contentWidths = useMemo<Record<string, number>>(() => {
    if (!filteredData.length) return {};
    const res: Record<string, number> = {};
    columns.forEach((col) => {
      const colId = col.id as string;

      const headerLen =
        typeof col.header === 'string' ? col.header.length : colId.length;

      const cellLen = filteredData.reduce(
        (m, r) =>
          Math.max(m, String((r as Record<string, any>)[colId] ?? '').length),
        0,
      );

      const px = Math.min(
        Math.max(Math.max(headerLen, cellLen) * PX_PER_CHAR + PADDING, MIN_WIDTH),
        MAX_WIDTH,
      );

      res[colId] = px;
    });
    return res;
  }, [columns, filteredData]);

  /* ------------------------------------------------------------------ */
  /*          2) итоговая ширина (stretch / shrink)                      */
  /* ------------------------------------------------------------------ */
  const [colWidths, setColWidths] = useState<Record<string, number>>(contentWidths);
  const containerRef = scrollRef; // используем тот же ref

  // пересчитываем при resize и при смене contentWidths
  useLayoutEffect(() => {
    function recalc(viewport: number) {
      const totalContent = Object.values(contentWidths).reduce((a, b) => a + b, 0);

      // начинаем с базовых
      let next: Record<string, number> = { ...contentWidths };

      if (totalContent < viewport) {
        // распределяем extra пропорционально
        const extra = viewport - totalContent;
        const ratio = extra / totalContent;

        next = Object.fromEntries(
          Object.entries(contentWidths).map(([k, w]) => [k, w + w * ratio]),
        );
      }
      setColWidths(next);
    }

    if (!containerRef.current) return;
    recalc(containerRef.current.clientWidth);

    const ro = new ResizeObserver(([entry]) => recalc(entry.contentRect.width));
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [contentWidths, containerRef]);

  /* -------------- virtual paddings -------------- */
  const virtualRows = rowVirtualizer.getVirtualItems();
  const paddingTop = virtualRows[0]?.start ?? 0;
  const paddingBottom =
    rowVirtualizer.getTotalSize() - (virtualRows.at(-1)?.end ?? 0);

  /* ----------------------- render ----------------------- */
  return (
    <DndContext
      onDragEnd={({ active, over }: DragEndEvent) => {
        if (!over || active.id === over.id) return;
        setColumnOrder((prev) =>
          arrayMove<string>(
            prev,
            prev.indexOf(active.id as string),
            prev.indexOf(over.id as string),
          ),
        );
      }}
    >
      <div ref={scrollRef} className="max-h-96 overflow-auto">
        <table className="min-w-max w-full text-sm border table-fixed">
          {/* ---------- colgroup ---------- */}
          <colgroup>
            {columns.map((c) => (
              <col
              key={c.id}
              style={{ width: `${colWidths[c.id as string] ?? MIN_WIDTH}px` }}
            />
            ))}
          </colgroup>

          {/* ---------- thead ---------- */}
          <thead className="bg-gray-100 select-none">
            <SortableContext items={columnOrder}>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((h) => (
                    <SortableTh key={h.id} id={h.id as string}>
                      {flexRender(h.column.columnDef.header, h.getContext())}
                    </SortableTh>
                  ))}
                </tr>
              ))}
            </SortableContext>
          </thead>

          {/* ---------- tbody ---------- */}
          <tbody>
            {paddingTop > 0 && (
              <tr style={{ height: `${paddingTop}px` }}>
                <td colSpan={columns.length} />
              </tr>
            )}

            {virtualRows.map((vRow) => {
              const row = table.getRowModel().rows[vRow.index];
              return (
                <tr key={row.id} style={{ height: rowHeight }}>
                  {row.getVisibleCells().map((cell) => {
                    const colId = cell.column.id as string;
                    const raw = cell.getValue();
                    const display = numericColumns.includes(colId)
                      ? raw !== undefined && raw !== null && raw !== ''
                        ? Number(raw).toLocaleString('ru-RU')
                        : ''
                      : flexRender(cell.column.columnDef.cell, cell.getContext());
                    return (
                      <td
                        key={cell.id}
                        className="border px-2 py-1 whitespace-nowrap overflow-hidden text-ellipsis"
                      >
                        {display}
                      </td>
                    );
                  })}
                </tr>
              );
            })}

            {paddingBottom > 0 && (
              <tr style={{ height: `${paddingBottom}px` }}>
                <td colSpan={columns.length} />
              </tr>
            )}
          </tbody>

          {/* ---------- tfoot ---------- */}
          {filteredData.length && numericColumns.length ? (
            <tfoot>
              <tr>
                {columns.map((c) =>
                  numericColumns.includes(c.id as string) ? (
                    <td key={c.id} className="font-bold text-[#0d1c3d]">
                      {numericSums[c.id as string].toLocaleString('ru-RU')}
                    </td>
                  ) : (
                    <td key={c.id} />
                  ),
                )}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </DndContext>
  );
}

/* ------------------------------------------------------------------ */
/*                        DRAGGABLE <TH>                              */
/* ------------------------------------------------------------------ */
function SortableTh({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, transform, transition, attributes, listeners } = useSortable({ id });

  return (
    <th
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      className="px-2 py-1 text-left"
    >
      <div className="flex items-center gap-1">
        <span {...listeners} className="cursor-move font-medium">
          {children}
        </span>
      </div>
    </th>
  );
}
