import React, { useState, useMemo, useEffect, useRef } from 'react';
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
        const sel = filters[k];
        if (!sel?.length) return true;
        return sel.includes(String(row[k] ?? ''));
      }),
    );
  }, [data, filters]);

  /* уникальные значения для FilterPopover (каскадно) */
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
    return keys.filter((k) =>
      filteredData.every((r) => r[k] === '' || !isNaN(Number(r[k]))),
    );
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

    /* 1. базовые */
    const base = Object.keys(data[0]).map((k) => ({ id: k, accessorKey: k }));

    /* 2. merge overrides */
    let merged = base.map((c) => ({ ...c, ...(columnsOverrides[c.id] ?? {}) }));

    /* 2a. фильтруем лишние колонки */
    if (columnsOrder?.length) {
      merged = merged.filter((c) => columnsOrder.includes(c.id as string));
    }

    /* 3. custom order */
    if (columnsOrder?.length) {
      merged.sort((a, b) =>
        columnsOrder.indexOf(a.id as string) - columnsOrder.indexOf(b.id as string),
      );
    }

    /* 4. header + FilterPopover + meta.excelHeader */
    return merged.map((c) => {
      const rawHeader =
        typeof c.header === 'string' ? c.header : (columnsOverrides[c.id]?.header as string) ?? c.id;

      return {
        ...c,
        meta: { ...c.meta, excelHeader: c.meta?.excelHeader ?? rawHeader },
        header: () => (
          <>
            {rawHeader}
            <FilterPopover
              columnId={c.id}
              data={filteredData}
              uniqueValues={uniqueValuesByKey[c.id] ?? []}
              selectedValues={filters[c.id] ?? []}
              onFilterChange={(sel) => setFilters((p) => ({ ...p, [c.id]: sel }))}
            />
          </>
        ),
      } as ColumnDef<T>;
    });
  }, [data, columnsOverrides, columnsOrder, filteredData, filters, uniqueValuesByKey]);

  useEffect(() => {
    setColumnOrder(columns.map((c) => c.id as string));
  }, [columns]);

  /* ------------------- virtualizer ------------------- */
  const rowHeight = 34;
  const overscan = typeof virtualized === 'object' ? virtualized.overscan ?? 10 : 10;
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: filteredData.length,
    getScrollElement: () => parentRef.current,
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

  useEffect(() => {
    onTableReady?.(table);
  }, [table, onTableReady]);

  /* -------------- colgroup widths ----------------- */
  const columnWidths = useMemo<Record<string, number>>(() => {
    if (!filteredData.length) return {};
    const pxPerChar = 8;
    const basePadding = 16;

    const res: Record<string, number> = {};

    columns.forEach((col) => {
      const colId = col.id as string;
      const headerLen = (col.meta?.excelHeader ?? colId).length;
      const cellLen = filteredData.reduce(
        (m, r) => Math.max(m, String((r as Record<string, any>)[colId] ?? '').length),
        0,
      );

      const px = Math.min(
        Math.max(Math.max(headerLen, cellLen) * pxPerChar + basePadding, 80),
        400,
      );
      res[colId] = px;
    });

    return res;
  }, [columns, filteredData]);

  /* -------------- virtual row paddings -------------- */
  const virtualRows = rowVirtualizer.getVirtualItems();
  const paddingTop = virtualRows[0]?.start ?? 0;
  const paddingBottom = rowVirtualizer.getTotalSize() - (virtualRows.at(-1)?.end ?? 0);

  /* ----------------------- render ----------------------- */
  return (
    <DndContext
      onDragEnd={({ active, over }: DragEndEvent) => {
        if (!over || active.id === over.id) return;
        setColumnOrder((prev) =>
          arrayMove(prev, prev.indexOf(active.id as string), prev.indexOf(over.id as string)),
        );
      }}
    >
      <div ref={parentRef} className="max-h-[80vh] overflow-auto">
        <table className="min-w-max w-max text-sm border table-auto">
          {/* colgroup */}
          <colgroup>
            {table
              .getHeaderGroups()[0]
              ?.headers.filter((h) => typeof h.id === 'string')
              .map((h) => (
                <col key={h.id} style={{ width: `${columnWidths[h.id as string]}px` }} />
              ))}
          </colgroup>

          {/* thead */}
          <thead className="bg-gray-100 select-none sticky top-0 z-20">
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

          {/* tbody */}
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

          {/* tfoot */}
          {!!filteredData.length && !!numericColumns.length && (
            <tfoot>
              <tr>
                {table.getVisibleLeafColumns().map((col) =>
                  numericColumns.includes(col.id as string) ? (
                    <td key={col.id} className="font-bold text-[#0d1c3d]">
                      {numericSums[col.id as string].toLocaleString('ru-RU')}
                    </td>
                  ) : (
                    <td key={col.id} />
                  ),
                )}
              </tr>
            </tfoot>
          )}
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
        <span {...listeners} className="cursor-move font-medium whitespace-nowrap">
          {children}
        </span>
      </div>
    </th>
  );
}
